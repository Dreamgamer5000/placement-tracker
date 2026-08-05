// Utility functions for parsing student data

export function extractBranch(regno: string): string {
  // Extract branch code from registration number
  // Format: XX**BCE**XXXX(X), XX**BPS**XXXX(X), etc.
  const match = regno.match(/\d{2}([A-Z]{3})\d+/i);
  if (match) {
    const branchCode = match[1].toUpperCase();
    return branchCode;
    // const branchMap: { [key: string]: string } = {
    //   'BCE': 'Computer Engineering',
    //   'BAI': 'Artificial Intelligence',
    //   'BPS': 'Cyber Physical Systems',
    //   'BDS': 'Data Science',
    //   'BCS': 'Computer Science',
    //   'BIT': 'Information Technology',
    //   'BEC': 'Electronics and Communication',
    //   'BEE': 'Electrical and Electronics',
    //   'BME': 'Mechanical Engineering',
    //   'BCV': 'Civil Engineering',
    //   'BCB': 'Chemical Engineering',
    //   'BBI': 'Biotechnology',
    // };
    // return branchMap[branchCode] || branchCode;
  }
  return 'Unknown';
}

export function extractCampus(regno: string): string {
  // Extract campus from registration number based on digit pattern
  // Vellore: XXXXX0XXX
  // Chennai: XXXXX1XXX or XXXXX5XXX
  // AP: XXXXX7XXX
  // Bhopal: XXXXX1XXXX (10 digits)
  
  if (regno.length === 10) {
    const sixthDigit = regno[5];
    if (sixthDigit === '1' || sixthDigit === '2') {
      return 'Bhopal';
    }
  }
  
  if (regno.length === 9) {
    const sixthDigit = regno[5];
    if (sixthDigit === '0') {
      return 'Vellore';
    } else if (sixthDigit === '1' || sixthDigit === '5') {
      return 'Chennai';
    } else if (sixthDigit === '7' || sixthDigit === '8') {
      return 'AP';
    }
  }
  
  return 'Unknown';
}

export function normalizeRegNo(regno: string): string {
  // Remove spaces and convert to uppercase
  return regno.trim().toUpperCase();
}

export function parseMarks(marks: string | number): number | undefined {
  if (typeof marks === 'number') {
    return marks;
  }
  const parsed = parseFloat(marks);
  return isNaN(parsed) ? undefined : parsed;
}

const HEADER_WORDS = new Set([
  'NEO', 'ID', 'NEOID', 'NEOIDS', 'REGNO', 'REGNOS', 'REGISTER', 'REGISTRATION', 
  'NUMBER', 'NUMBERS', 'NAME', 'NAMES', 'STATUS', 'STATE', 'SERIAL', 'SL', 'NO', 
  'SNO', 'S.NO', 'SELECTED', 'PLACED', 'INTERN', 'OFFER', 'TYPE', 'GENDER', 'BRANCH', 'CAMPUS'
]);

export function extractCleanTokens(input: string | string[]): string[] {
  const rawText = Array.isArray(input) ? input.join(' ') : (input || '');
  if (!rawText.trim()) return [];

  const rawTokens = rawText.split(/[\s,;\t\r\n]+/);
  const result: string[] = [];
  const seen = new Set<string>();

  for (let token of rawTokens) {
    token = token.trim();
    if (!token) continue;
    
    token = token.replace(/^\d+[\.\)]/, '').trim();
    if (!token) continue;

    const upper = token.toUpperCase();
    
    if (HEADER_WORDS.has(upper)) continue;

    if (!/^[A-Z0-9]{5,20}$/i.test(upper)) continue;

    if (!seen.has(upper)) {
      seen.add(upper);
      result.push(upper);
    }
  }

  return result;
}

