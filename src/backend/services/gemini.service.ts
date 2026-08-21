import fs from 'fs';
import { join } from 'path';

export interface CompanyParsedData {
  name: string;
  category: string;
  role: string;
  ctc: string;
  stipend: string;
  job_location: string;
  eligible_branches: string;
  eligibility_criteria: string;
  website: string;
}

function getApiKey(): string | undefined {
  if (!process.env.GEMINI_API_KEY) {
    try {
      if (typeof process.loadEnvFile === 'function') {
        const envPath = join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          process.loadEnvFile(envPath);
        }
      }
    } catch (_) {}
  }

  let key = process.env.GEMINI_API_KEY?.trim();
  if (key) {
    // Strip optional surrounding quotes if present
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      key = key.slice(1, -1).trim();
    }
  }
  return key;
}

const SYSTEM_INSTRUCTION = `You are an accurate, strict placement email information extraction assistant. Your task is to extract structured details from placement cell notifications and company announcements.

CRITICAL EXTRACTION RULES:
1. Extract ONLY information that is explicitly stated in the provided text.
2. If any field is missing, not mentioned, or cannot be found directly in the text, return an empty string "" for that field. DO NOT invent, guess, assume, or extrapolate any values.
3. Do not pull facts from pre-trained knowledge about the company (e.g. do not guess the company website, typical salary, or headquarters if not written in the email).
4. Format fields cleanly:
   - name: Company Name (e.g., "Google", "Saviynt", "Oracle")
   - category: Tier or category if mentioned (e.g. "Super Dream", "Dream", "Internship + FTE", "Regular")
   - role: Job role / profile (e.g. "Software Development Engineer", "Associate Consultant")
   - ctc: Full-time CTC / package mentioned (e.g. "18 LPA", "12 - 15 LPA", "₹14,00,000 P.A.")
   - stipend: Monthly stipend during internship if mentioned (e.g. "50,000 / month", "₹40k/pm")
   - job_location: Job or training location (e.g. "Bangalore / Hyderabad", "Pan India", "Remote")
   - eligible_branches: Eligible engineering/degree streams (e.g. "B.Tech CSE, IT, ECE", "All B.Tech branches")
   - eligibility_criteria: Academic cutoff / CGPA / active backlogs / 10th/12th criteria (e.g. "CGPA >= 7.5, No standing arrears, 10th & 12th > 70%")
   - website: Company website URL if mentioned in the email (e.g. "https://example.com")`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'Company name. Empty string if not mentioned.' },
    category: { type: 'STRING', description: 'Placement category or tier (e.g. Super Dream, Dream). Empty string if not mentioned.' },
    role: { type: 'STRING', description: 'Job role or designation. Empty string if not mentioned.' },
    ctc: { type: 'STRING', description: 'Full-time salary / CTC. Empty string if not mentioned.' },
    stipend: { type: 'STRING', description: 'Internship stipend amount. Empty string if not mentioned.' },
    job_location: { type: 'STRING', description: 'Work or posting location. Empty string if not mentioned.' },
    eligible_branches: { type: 'STRING', description: 'Eligible departments or branches. Empty string if not mentioned.' },
    eligibility_criteria: { type: 'STRING', description: 'CGPA, 10th/12th marks, backlog criteria. Empty string if not mentioned.' },
    website: { type: 'STRING', description: 'Official website URL. Empty string if not mentioned.' }
  },
  required: [
    'name',
    'category',
    'role',
    'ctc',
    'stipend',
    'job_location',
    'eligible_branches',
    'eligibility_criteria',
    'website'
  ]
};

/**
 * Parses placement notification email text using Gemini 2.0 Flash with structured JSON output.
 * @param emailText Raw text of the placement email pasted by the user.
 * @returns Structured CompanyParsedData object with extracted values.
 */
export async function parsePlacementEmail(emailText: string): Promise<CompanyParsedData> {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend environment (.env). Please add your Google AI Studio API key to enable AI parsing.');
  }

  if (!emailText || !emailText.trim()) {
    throw new Error('Email text is empty. Please paste the placement email content.');
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Placement Email Text:\n"""\n${emailText.trim()}\n"""`
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: SYSTEM_INSTRUCTION
        }
      ]
    },
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA
    }
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (networkErr: any) {
    throw new Error(`Network error connecting to Gemini API: ${networkErr.message || networkErr}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMsg = `Gemini API returned error HTTP ${response.status}`;
    try {
      const parsedErr = JSON.parse(errorBody);
      if (parsedErr.error?.message) {
        errorMsg = `Gemini API: ${parsedErr.error.message}`;
      }
    } catch (_) {}
    throw new Error(errorMsg);
  }

  const result = await response.json();
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('Gemini API returned an empty response. Please verify the email content and try again.');
  }

  try {
    const parsed: CompanyParsedData = JSON.parse(textContent);
    return {
      name: parsed.name?.trim() || '',
      category: parsed.category?.trim() || '',
      role: parsed.role?.trim() || '',
      ctc: parsed.ctc?.trim() || '',
      stipend: parsed.stipend?.trim() || '',
      job_location: parsed.job_location?.trim() || '',
      eligible_branches: parsed.eligible_branches?.trim() || '',
      eligibility_criteria: parsed.eligibility_criteria?.trim() || '',
      website: parsed.website?.trim() || ''
    };
  } catch (jsonErr: any) {
    throw new Error(`Failed to parse structured response from Gemini: ${jsonErr.message}`);
  }
}
