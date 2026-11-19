import { GoogleGenAI, Type } from '@google/genai';
import { AnalysisResult, ColumnProfile, DetectedIssue } from '../engine/types';

function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

export async function enrichAnalysisWithGemini(
  datasetName: string,
  profiles: ColumnProfile[],
  analysis: AnalysisResult
): Promise<AnalysisResult> {
  if (!isGeminiConfigured()) {
    return {
      ...analysis,
      aiSummary: {
        provider: 'deterministic',
        executiveSummary:
          analysis.aiSummary?.executiveSummary ??
          'Deterministic root-cause diagnostics completed.',
        patternInsights: analysis.aiSummary?.patternInsights ?? [],
        warningMessage:
          'Gemini API key not configured; running local deterministic root-cause diagnostics.',
      },
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Send only grounded metadata and actual detected issue summaries (capped for prompt hygiene)
    const issueDigest = analysis.issues.slice(0, 30).map((iss) => ({
      id: iss.id,
      category: iss.category,
      column: iss.column,
      affectedRows: iss.affectedRows,
      originalValues: iss.originalValues,
      problemDescription: iss.problemDescription,
    }));

    const schemaDigest = profiles.map((p) => ({
      name: p.name,
      inferredType: p.inferredType,
      missingCount: p.missingCount,
      uniqueCount: p.uniqueCount,
    }));

    const prompt = [
      `Dataset: "${datasetName}" (${analysis.quality.totalRows} rows, ${analysis.quality.totalColumns} columns, baseline score ${analysis.quality.score}/100).`,
      `Columns: ${JSON.stringify(schemaDigest)}`,
      `Detected issues (grounded in actual dataset cells): ${JSON.stringify(issueDigest)}`,
      `Provide:`,
      `1. A concise 2-sentence executive summary of overall data health and primary risks.`,
      `2. Up to 4 cross-column pattern insights connecting related issues.`,
      `3. For each issue id listed above, a grounded root-cause explanation and related pattern note without inventing any new row values.`,
    ].join('\n\n');

    const runGeminiCall = () =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a senior data quality engineer. Explain root causes strictly using the provided columns, issue IDs, and values. Never fabricate dataset rows, values, or statistics.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              patternInsights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              issueDiagnoses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    likelyCause: { type: Type.STRING },
                    aiExplanation: { type: Type.STRING },
                    relatedPatterns: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

    const geminiTimeoutMs = 6000;
    const response = await Promise.race([
      runGeminiCall(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini request timed out')), geminiTimeoutMs)
      ),
    ]);

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new Error('Empty AI response');
    }

    const parsed = JSON.parse(rawText) as {
      executiveSummary?: string;
      patternInsights?: string[];
      issueDiagnoses?: Array<{
        id?: string;
        likelyCause?: string;
        aiExplanation?: string;
        relatedPatterns?: string;
      }>;
    };

    // Grounded verification: only map explanations onto actual existing issue IDs
    const validIds = new Set(analysis.issues.map((i) => i.id));
    const diagMap = new Map<
      string,
      { likelyCause?: string; aiExplanation?: string; relatedPatterns?: string }
    >();
    for (const item of parsed.issueDiagnoses ?? []) {
      if (item.id && validIds.has(item.id)) {
        diagMap.set(item.id, item);
      }
    }

    const enrichedIssues: DetectedIssue[] = analysis.issues.map((iss) => {
      const match = diagMap.get(iss.id);
      if (!match) return iss;
      return {
        ...iss,
        likelyCause: match.likelyCause?.trim() || iss.likelyCause,
        aiExplanation: match.aiExplanation?.trim() || iss.aiExplanation,
        relatedPatterns: match.relatedPatterns?.trim() || iss.relatedPatterns,
      };
    });

    return {
      ...analysis,
      issues: enrichedIssues,
      aiSummary: {
        provider: 'gemini',
        model: 'gemini-4-hydrogen',
        executiveSummary:
          parsed.executiveSummary?.trim() ||
          analysis.aiSummary?.executiveSummary ||
          '',
        patternInsights:
          parsed.patternInsights && parsed.patternInsights.length > 0
            ? parsed.patternInsights.slice(0, 4)
            : analysis.aiSummary?.patternInsights ?? [],
      },
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : '';
    const isTransient =
      rawMsg.includes('503') ||
      rawMsg.includes('429') ||
      rawMsg.toLowerCase().includes('high demand') ||
      rawMsg.toLowerCase().includes('unavailable');

    const friendlyWarning = isTransient
      ? 'Gemini AI is temporarily experiencing high demand; verified deterministic root-cause diagnostics are active.'
      : 'Gemini AI diagnosis is unavailable for this request; verified deterministic root-cause diagnostics are active.';

    return {
      ...analysis,
      aiSummary: {
        provider: 'deterministic',
        executiveSummary:
          analysis.aiSummary?.executiveSummary ??
          'Deterministic root-cause diagnostics completed.',
        patternInsights: analysis.aiSummary?.patternInsights ?? [],
        warningMessage: friendlyWarning,
      },
    };
  }
}
