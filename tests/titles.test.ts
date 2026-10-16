import { describe, expect, it } from 'vitest';
import { getChannelAdapter } from '@/channels';
import { engineCodes, parseEngine, withEngineData } from '@/domain/engine';
import {
  buildSeeds,
  buildWordMap,
  checkTitle,
  cleanSeeds,
  familyBase,
  parsePastedSuggestions,
  titleCoverage,
  tokenize,
  wordKey,
} from '@/domain/titles';
import { cleanChars, parseTitleRules, structureFor, titleRulesInputSchema } from '@/domain/title-rules';

// Datos inventados.

describe('motor', () => {
  it('saca cilindrada y combustible del texto del motor', () => {
    expect(parseEngine('1.9 Diesel XUD9')).toEqual({ displacement: '1.9', fuel: 'Diesel' });
    expect(parseEngine('2,0 16v nafta')).toEqual({ displacement: '2.0', fuel: 'Nafta' });
    expect(parseEngine('1.6 8v')).toEqual({ displacement: '1.6', fuel: null });
    expect(parseEngine('2.5 TD')).toEqual({ displacement: '2.5', fuel: 'Diesel' });
    expect(parseEngine('11.5')).toEqual({ displacement: null, fuel: null });
    expect(parseEngine(null)).toEqual({ displacement: null, fuel: null });
  });

  it('los códigos son lo que no es cilindrada, válvulas ni combustible', () => {
    expect(engineCodes('1.9 Diesel XUD9')).toEqual(['xud9']);
    expect(engineCodes('1.6 8v Zetec Rocam')).toEqual(['zetec', 'rocam']);
  });

  it('completa solo lo que no viene', () => {
    expect(withEngineData({ engine: '1.9 Diesel' })).toMatchObject({ displacement: '1.9', fuel: 'Diesel' });
    expect(withEngineData({ engine: '1.9 Diesel', displacement: null, fuel: 'Nafta' })).toMatchObject({
      displacement: null,
      fuel: 'Nafta',
    });
  });
});

describe('semillas', () => {
  it('toma la familia sin paréntesis ni la parte después de la barra', () => {
    expect(familyBase('Subconjunto (pistones + aros)')).toBe('subconjunto');
    expect(familyBase('Juego de juntas / descarbonización')).toBe('juego de juntas');
    expect(familyBase('')).toBeNull();
  });

  it('combina la familia con modelos, códigos de motor y marca con cilindrada', () => {
    const seeds = buildSeeds({
      productType: 'Subconjunto (pistones + aros)',
      compatibilities: [
        { vehicleBrand: 'Peugeot', model: '405', engine: '1.9 Diesel XUD9', displacement: '1.9' },
        { vehicleBrand: 'Peugeot', model: '306', engine: '1.9 Diesel XUD9', displacement: '1.9' },
      ],
    });
    expect(seeds).toEqual(['subconjunto 405', 'subconjunto 306', 'subconjunto xud9', 'subconjunto peugeot 1.9']);
  });

  it('sin cilindrada, la marca sola', () => {
    expect(
      buildSeeds({ productType: 'Subconjunto', compatibilities: [{ vehicleBrand: 'Peugeot', model: null, engine: '8v', displacement: null }] }),
    ).toEqual(['subconjunto peugeot']);
  });

  it('sin compatibilidades queda la familia sola; sin familia, ninguna', () => {
    expect(buildSeeds({ productType: 'Kit de embrague', compatibilities: [] })).toEqual(['kit de embrague']);
    expect(buildSeeds({ productType: null, compatibilities: [] })).toEqual([]);
  });

  it('limpia las semillas que escribe la persona', () => {
    expect(cleanSeeds(['  Kit  Gol ', 'kit gol', '', 'kit fiesta'])).toEqual(['kit gol', 'kit fiesta']);
  });

  it('lee las sugerencias pegadas, una por línea', () => {
    expect(parsePastedSuggestions('1. Subconjunto 405\n• subconjunto 405 diesel\n\n- subconjunto 405 diesel\nSubconjunto Peugeot')).toEqual([
      'subconjunto 405',
      'subconjunto 405 diesel',
      'subconjunto peugeot',
    ]);
  });
});

describe('mapa de palabras', () => {
  it('cuenta de dónde sale cada palabra y respeta cómo la escribe la gente', () => {
    const map = buildWordMap(
      ['subconjunto 405 diesel', 'subconjunto peugeot 405', 'pistones 405'],
      ['Subconjunto Pistones Peugeot 405 1.9 Diesel'],
      { [wordKey('diesel')]: 'use', [wordKey('peugeot')]: 'discard' },
    );
    const by = Object.fromEntries(map.map((e) => [e.word, e]));
    expect(by['405']).toMatchObject({ inSuggestions: 3, inCompetitors: 1, source: 'both', order: 1 });
    expect(by['subconjunto'].order).toBe(0);
    expect(by['subconjunto']).toMatchObject({ inSuggestions: 2, inCompetitors: 1 });
    expect(by['1.9']).toMatchObject({ inSuggestions: 0, inCompetitors: 1, source: 'competitors' });
    expect(by['diesel'].status).toBe('use');
    expect(by['peugeot'].status).toBe('discard');
    // Singular y plural cuentan como la misma palabra.
    expect(by['pistones'].inSuggestions).toBe(1);
    expect(map[0].word).toBe('405');
  });

  it('no cuenta conectores ni letras sueltas', () => {
    const words = buildWordMap(['kit de embrague para gol a'], []).map((e) => e.word);
    expect(words.sort()).toEqual(['embrague', 'gol', 'kit']);
  });
});

describe('cobertura y reglas', () => {
  const rules = getChannelAdapter('MERCADOLIBRE').titleRules;

  it('una búsqueda queda cubierta si el título tiene todas sus palabras', () => {
    const r = titleCoverage('Subconjunto Pistón Peugeot 405 1.9 Diesel', [
      'subconjunto 405',
      'pistones 405 diesel',
      'subconjunto partner',
    ]);
    expect(r.covered).toEqual(['subconjunto 405', 'pistones 405 diesel']);
    expect(r.missing).toEqual(['subconjunto partner']);
  });

  it('marca lo que impide aprobar y lo que es solo un aviso', () => {
    const long = 'Subconjunto Pistones Aros Peugeot 405 306 Partner 1.9 Diesel Xud9 Persan';
    const r = checkTitle(`${long} Oferta!`, rules);
    expect(r.length).toBe(long.length + 8);
    expect(r.errors).toEqual([
      `Tiene ${long.length + 8} caracteres y el máximo es 60.`,
      'Tiene signos no permitidos: !',
      'Tiene palabras no permitidas: oferta.',
    ]);
    const ok = checkTitle('Subconjunto Peugeot 405 Peugeot', rules, { usableWords: ['subconjunto', 'peugeot'] });
    expect(ok.errors).toEqual([]);
    expect(ok.warnings).toEqual(['Repite palabras: peugeot.', 'Usa palabras que no tildaste: 405.']);
  });

  it('las frases prohibidas se buscan como palabras enteras, sin tildes', () => {
    expect(checkTitle('Kit Envio Gratis', rules).errors).toEqual(['Tiene palabras no permitidas: envío gratis, envio gratis.']);
    expect(checkTitle('Kit Stockholm', rules).errors).toEqual([]);
  });

  it('tokeniza la cilindrada con coma o punto igual', () => {
    expect(tokenize('Motor 1,9 TD')).toEqual(['motor', '1.9', 'td']);
  });
});

describe('reglas de título', () => {
  it('valida lo que se carga en Ajustes', () => {
    const r = titleRulesInputSchema.parse({
      maxLength: '60',
      forbiddenChars: ' ! ¡ !* ',
      forbiddenWords: ['Oferta', ' oferta ', '', 'envío  gratis'],
      structures: [{ family: 'Kit de embrague', structure: ' Tipo + Modelo ' }, { family: 'x', structure: '' }],
    });
    expect(r).toEqual({
      maxLength: 60,
      forbiddenChars: '!¡*',
      forbiddenWords: ['Oferta', 'oferta', 'envío gratis'],
      structures: [{ family: 'Kit de embrague', structure: 'Tipo + Modelo' }],
    });
    expect(titleRulesInputSchema.safeParse({ maxLength: '5', forbiddenChars: '', forbiddenWords: [], structures: [] }).success).toBe(false);
    expect(cleanChars('a a')).toBe('a');
  });

  it('la estructura de la familia, o la general', () => {
    const rules = parseTitleRules({
      maxLength: 60,
      forbiddenChars: '',
      forbiddenWords: [],
      structures: [
        { family: '', structure: 'General' },
        { family: 'Kit de embrague', structure: 'Embrague' },
      ],
    });
    expect(structureFor(rules, 'kit de embrague')).toBe('Embrague');
    expect(structureFor(rules, 'Pistones')).toBe('General');
  });

  it('el link de búsqueda de Mercado Libre', () => {
    expect(getChannelAdapter('MERCADOLIBRE').searchUrl('Subconjunto Peugeot 1.9 Diésel')).toBe(
      'https://listado.mercadolibre.com.ar/subconjunto-peugeot-1.9-diesel',
    );
  });
});
