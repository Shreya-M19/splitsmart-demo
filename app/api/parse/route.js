import { NextResponse } from 'next/server';

function cleanJSON(rawText) {
  if (!rawText) return null;

  const trimmed = rawText.trim();
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

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { amount: 0, people: 0, each: 0 };
  }

  const amount = Number(payload.amount ?? payload.total ?? payload.bill ?? 0);
  const people = Number(payload.people ?? payload.numPeople ?? payload.number_of_people ?? 0);
  const each = Number(payload.each ?? payload.amountEach ?? payload.perPerson ?? payload.per_person ?? 0);

  const cleanAmount = Number.isFinite(amount) ? amount : 0;
  const cleanPeople = Number.isFinite(people) ? Math.max(0, people) : 0;
  const cleanEach = Number.isFinite(each) ? each : cleanPeople > 0 ? Number((cleanAmount / cleanPeople).toFixed(2)) : 0;

  return {
    amount: cleanAmount,
    people: cleanPeople,
    each: cleanEach,
  };
}

function parseSentenceFallback(text) {
  const cleanText = text.replace(/,/g, '');

  const amountMatch =
    cleanText.match(/(?:total|bill|cost|was|is|for|of|spent|paid|came to|amount|charge)\s*(?:of)?\s*\$?(\d+(?:\.\d+)?)/i) ||
    cleanText.match(/\$?(\d+(?:\.\d+)?)(?=\s*(?:split|between|among|for|of\s+us|people|persons?|friends?|ppl|folks|guys|way|ways|each|per))/i) ||
    cleanText.match(/\$?(\d+(?:\.\d+)?)/i);

  const peopleMatch =
    cleanText.match(/(?:between|among|for|with|into|across)\s*(\d+)\s*(?:of\s+us|people|persons?|friends?|ppl|folks|guys|way|ways)/i) ||
    cleanText.match(/(?:split|splitting)\s+(?:equally|evenly)?\s*(?:between|among|across)?\s*(\d+)\s*(?:ways?|way)/i) ||
    cleanText.match(/(?:for|with)\s*(\d+)\s*(?:of\s+us|friends?|guys|folks|people|persons?)/i) ||
    cleanText.match(/(\d+)\s*(?:of\s+us|people|persons?|friends?|ppl|folks|guys)/i) ||
    cleanText.match(/\b(\d+)\b(?=\s*(?:of\s+us|people|persons?|friends?|ppl|folks|guys|ways?|way)\b)/i);

  const amount = amountMatch ? Number(amountMatch[1].replace(/[$,]/g, '')) : 0;
  const people = peopleMatch ? Number(peopleMatch[1]) : 0;
  const each = people > 0 ? Number((amount / people).toFixed(2)) : 0;

  return normalizePayload({ amount, people, each });
}

export async function POST(request) {
  try {
    const { text } = await request.json();
    const userText = String(text || '').trim();

    if (!userText) {
      return NextResponse.json({ amount: 0, people: 0, each: 0, error: 'No text provided' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const prompt = `Read this bill sentence and return ONLY valid JSON with exactly these keys: "amount", "people", and "each". Use numeric values only. The sentence is: "${userText}"`;

    if (!apiKey) {
      return NextResponse.json(parseSentenceFallback(userText));
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      throw new Error(geminiData?.error?.message || 'Gemini request failed');
    }

    const rawResponse =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join('') || '{}';

    const parsed = cleanJSON(rawResponse) || normalizePayload({});
    return NextResponse.json(normalizePayload(parsed));
  } catch (error) {
    return NextResponse.json(
      { amount: 0, people: 0, each: 0, error: error.message || 'Unexpected parse error' },
      { status: 400 },
    );
  }
}
