import { normalizeText, type ChannelCatalog } from '@/domain/catalog-data';
import { familyBase } from '@/domain/titles';
import { ML_CATEGORIES } from './categories';

// La categoría de Mercado Libre de cada familia de producto. La familia es el
// tipo de producto de la ficha. Las que no están acá, por ejemplo "Otros", se
// eligen a mano en la publicación.
const FAMILY_CATEGORY: Record<string, string> = {
  'Subconjunto (pistones + aros)': 'MLA373289',
  'Conjunto (con camisas)': 'MLA373289',
  'Kit de embrague': 'MLA373460',
  'Kit de distribución': 'MLA373298',
  'Juego de juntas / descarbonización': 'MLA458878',
  Camisas: 'MLA429225',
  Aros: 'MLA373288',
  Pistones: 'MLA47093',
  Cigüeñal: 'MLA61251',
  'Cojinetes de biela y bancada': 'MLA374967',
  Bielas: 'MLA47083',
  'Tapa de cilindros': 'MLA60937',
  'Válvulas, guías y botadores': 'MLA47123',
  'Bomba de aceite': 'MLA60626',
  'Bomba de agua': 'MLA60598',
  'Junta de tapa de cilindros': 'MLA458869',
  'Otras juntas': 'MLA373322',
};

const byFamily = new Map(Object.entries(FAMILY_CATEGORY).map(([family, id]) => [normalizeText(family), id]));
// Por si la familia está escrita sin la aclaración, por ejemplo "Subconjunto" o "Juego de juntas".
const byBase = new Map(
  Object.entries(FAMILY_CATEGORY).map(([family, id]) => [normalizeText(familyBase(family) ?? family), id]),
);
const byId = new Map(ML_CATEGORIES.map((c) => [c.id, c]));

export const mercadolibreCatalog: ChannelCatalog = {
  categories: ML_CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
  categoryForFamily(family) {
    if (!family?.trim()) return null;
    return byFamily.get(normalizeText(family)) ?? byBase.get(normalizeText(familyBase(family) ?? '')) ?? null;
  },
  category: (id) => byId.get(id) ?? null,
};
