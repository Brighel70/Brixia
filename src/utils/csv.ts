export function toCsv(rows: any[], headers: string[]){
  const esc = (v:any) => '"' + String(v ?? '').replace(/"/g,'""') + '"'
  const head = headers.map(esc).join(';')
  const body = rows.map(r => headers.map(h => esc(r[h])).join(';')).join('\n')
  return head + '\n' + body
}