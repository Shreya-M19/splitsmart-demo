import { NextResponse } from 'next/server';

function clampNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { amount: 0, people: 0, each: 0 };
  }

  const amount = clampNumber(payload.amount ?? payload.total ?? payload.bill ?? payload.value ?? 0);
  const people = clampNumber(payload.people ?? payload.numPeople ?? payload.number_of_people ?? payload.groupSize ?? 0);
  const each = clampNumber(payload.each ?? payload.perPerson ?? payload.amountEach ?? payload.share ?? 0);

  const safePeople = Math.max(0, people);
  const safeAmount = Math.max(0, amount);
  const safeEach = each > 0 ? each : safePeople > 0 ? Number((safeAmount / safePeople).toFixed(2)) : 0;

  return {
    amount: safeAmount,
    people: safePeople,
    each: safeEach,
  };
}

function cleanJSON(rawText) {
  if (!rawText) return null;
  const trimmed = String(rawText).trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(jsonText);
  } catch {
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!objectMatch) return null;
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      return null;
    }
  }
}

function parseSentenceFallback(text) {
  const cleanText = String(text || '').replace(/,/g, '');

  const amountPatterns = [
    /(?:total|bill|cost|was|is|for|spent|paid|came to|amount|charge)\s*(?:of)?\s*\$?(\d+(?:\.\d+)?)/i,
    /\$?(\d+(?:\.\d+)?)(?=\s*(?:split|between|among|for|of\s+us|people|persons?|friends?|ppl|folks|guys|way|ways|each|per|equally))/i,
    /\$?(\d+(?:\.\d+)?)/i,
  ];

  const peoplePatterns = [
    /(?:between|among|for|with|into|across)\s*(\d+)\s*(?:of\s+us|people|persons?|friends?|ppl|folks|guys|way|ways)/i,
    /(?:split|splitting)\s+(?:equally|evenly)?\s*(?:between|among|across)?\s*(\d+)\s*(?:way|ways)/i,
    /(?:for|with)\s*(\d+)\s*(?:of\s+us|friends?|guys|folks|people|persons?)/i,
    /(\d+)\s*(?:of\s+us|people|persons?|friends?|ppl|folks|guys|way|ways)/i,
    /\b(\d+)\b(?=\s*(?:of\s+us|people|persons?|friends?|ppl|folks|guys|way|ways)\b)/i,
  ];

  const amountMatch = amountPatterns.find((pattern) => pattern.test(cleanText));
  const peopleMatch = peoplePatterns.find((pattern) => pattern.test(cleanText));

  const amount = amountMatch ? Number((cleanText.match(amountMatch) || [])[1].replace(/[$]/g, '')) : 0;
  const people = peopleMatch ? Number((cleanText.match(peopleMatch) || [])[1]) : 0;
  const each = people > 0 ? Number((amount / people).toFixed(2)) : 0;

  return normalizePayload({ amount, people, each });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const userText = String(body?.text || '').trim();

    if (!userText) {
      return NextResponse.json({ amount: 0, people: 0, each: 0, error: 'No text provided' }, { status: 400 });
    }

    const fallbackData = parseSentenceFallback(userText);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(fallbackData);
    }

    try {
      const prompt = `Return ONLY valid JSON with exactly these keys: "amount","people","each". Use numbers only. Example: {"amount":1800,"people":4,"each":450}. Sentence: "${userText}"`;

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0,
            },
          }),
        },
      );

      if (!geminiResponse.ok) {
        throw new Error('Gemini unavailable');
      }

      const geminiData = await geminiResponse.json();
      const rawResponse = geminiData?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') || '{}';
      const parsed = cleanJSON(rawResponse);

      if (parsed) {
        return NextResponse.json(normalizePayload(parsed));
      }
    } catch {
      // If Gemini is busy or unavailable, fall back to the parser in the app.
    }

    return NextResponse.json(fallbackData);
  } catch (error) {
    return NextResponse.json(
      { amount: 0, people: 0, each: 0, error: error.message || 'Unexpected parse error' },
      { status: 400 },
    );
  }
}
