import fs from 'fs';
const content = fs.readFileSync('/home/dream/Documents/placement tracker/tracker/src/frontend/components/CompanyList.svelte', 'utf8');
const match = content.match(/<button[^>]*>[\s\S]*?Rename[\s\S]*?<\/button>/);
console.log(match ? match[0] : 'Not found');
