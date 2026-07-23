import { getBrandConfig } from '@/config/brand'

/** Emoji come code point per evitare problemi di encoding in build/browser */
const E = (n: number) => String.fromCodePoint(n)

/** Messaggio auguri compleanno - emoji costruite a runtime */
export function getBirthdayMessage(personName: string): string {
  const clubName = getBrandConfig().clubName || 'la società'
  return [
    E(0x1F3C9) + E(0x1F389) + ' Ehi ' + personName + '! Oggi si festeggia forte! ' + E(0x1F382) + E(0x1F973),
    '',
    'Tantissimi auguri da tutta la famiglia ' + clubName + '! ' + E(0x1F499),
    'Che il tuo compleanno sia pieno di sorrisi, energia ed entusiasmo,',
    'e ricco di mete nella tua vita! ' + E(0x1F4AA) + E(0x1F525),
    '',
    'Goditi la giornata come dopo una grande vittoria ' + E(0x1F4A5),
    '',
    'Un abbraccio enorme,',
    clubName + ' ' + E(0x1F3C9) + E(0x1F499)
  ].join('\n')
}
