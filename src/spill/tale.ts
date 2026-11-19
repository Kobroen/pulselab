// Opplesing med nettleserens egen talesyntese. Bare stemmer som ligger på enheten
// brukes, så teksten aldri sendes ut. Finnes ingen slik norsk stemme, er opplesing av.

/** Tegn som stemmene ofte leser feil eller hopper over. */
const UTTALE: [RegExp, string][] = [
  [/×|·/g, ' ganger '],
  [/÷|:(?=\s*\d)/g, ' delt på '],
  [/−|(?<=\d\s)-(?=\s\d)/g, ' minus '],
  [/\+/g, ' pluss '],
  [/=/g, ' er lik '],
  [/_{2,}/g, ' … '],
];

export class Tale {
  /** Skrudd på av læreren. */
  på = false;
  private stemme: SpeechSynthesisVoice | null = null;
  private syntese: SpeechSynthesis | null = 'speechSynthesis' in window ? window.speechSynthesis : null;

  /** Kalles når stemmene er funnet, som kan skje en stund etter at siden er lastet. */
  vedEndring: (() => void) | null = null;

  constructor() {
    this.finnStemme();
    this.syntese?.addEventListener?.('voiceschanged', () => this.finnStemme());
  }

  private finnStemme() {
    const lokale = (this.syntese?.getVoices() ?? []).filter((s) => s.localService);
    const språk = (s: SpeechSynthesisVoice) => s.lang.toLowerCase().replace('_', '-');
    this.stemme =
      lokale.find((s) => språk(s).startsWith('nb')) ??
      lokale.find((s) => språk(s).startsWith('no')) ??
      lokale.find((s) => språk(s).startsWith('nn')) ??
      null;
    this.vedEndring?.();
  }

  /** Sann når enheten har en norsk stemme som ikke bruker nettet. */
  get tilgjengelig() {
    return this.stemme !== null;
  }

  /** Leser teksten. Det som eventuelt leses fra før, avbrytes. */
  si(tekst: string) {
    if (!this.på || !this.stemme || !this.syntese) return;
    this.syntese.cancel();
    for (const [fra, til] of UTTALE) tekst = tekst.replace(fra, til);
    const ytring = new SpeechSynthesisUtterance(tekst);
    ytring.voice = this.stemme;
    ytring.lang = this.stemme.lang;
    ytring.rate = 0.9;
    this.syntese.speak(ytring);
  }

  stopp() {
    this.syntese?.cancel();
  }
}
