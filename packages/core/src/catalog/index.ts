import { inches, feet } from '../units.js';
import type { Variety } from '../variety.js';

/**
 * The bundled plant catalog (D-006, D-012).
 *
 * Curated by hand, not scraped. A hundred entries with correct spacing and
 * days-to-maturity beat ten thousand with bad numbers, and a live plant-database
 * API would break offline-first anyway — you would need the network to plan.
 *
 * **Provenance.** Horticultural figures are the conventional ones for this
 * region. Nativity is recorded at `state:IN` and `ecoregion3:55` (Eastern Corn
 * Belt Plains) from reference lists rather than derived from the USDA PLANTS
 * distribution data, which this environment cannot reach. That makes the
 * nativity layer *curated* rather than *authoritative*, and the catalog says so
 * rather than implying otherwise — replace it with the PLANTS join when the
 * download is available.
 *
 * Bump CATALOG_VERSION when entries change. User additions carry `isCustom` and
 * are never overwritten by an update.
 */
export const CATALOG_VERSION = 1;
export const NATIVITY_PROVENANCE =
  'curated from regional reference lists; not yet joined to USDA PLANTS distribution data';

const IN_NATIVE = ['state:IN', 'ecoregion3:55'] as const;

type Spec = Partial<Variety> & Pick<Variety, 'id' | 'commonName' | 'family' | 'lifecycle'>;

function v(spec: Spec): Variety {
  return {
    dtmFrom: 'sow',
    spacingMm: inches(12),
    sunRequirement: 'full',
    moisture: 'medium',
    sowMethod: 'directSow',
    frostTolerance: 'tender',
    feederClass: 'moderate',
    nativeToRegions: [],
    hostGenera: [],
    seedLongevityYears: 3,
    isCustom: false,
    ...spec,
  } as Variety;
}

/* ------------------------------------------------------------ vegetables */

const vegetables: Variety[] = [
  v({ id: 'tomato', commonName: 'Tomato', scientificName: 'Solanum lycopersicum', family: 'Solanaceae', genus: 'Solanum',
      lifecycle: 'annual', daysToMaturity: 75, dtmFrom: 'transplant', spacingMm: inches(24), plantsPerCell: 0.25,
      matureHeightMm: feet(6), sowMethod: 'transplant', feederClass: 'heavy', seedLongevityYears: 4 }),
  v({ id: 'pepper-sweet', commonName: 'Sweet pepper', scientificName: 'Capsicum annuum', family: 'Solanaceae', genus: 'Capsicum',
      lifecycle: 'annual', daysToMaturity: 70, dtmFrom: 'transplant', spacingMm: inches(18), plantsPerCell: 1,
      sowMethod: 'transplant', feederClass: 'heavy', seedLongevityYears: 2 }),
  v({ id: 'pepper-hot', commonName: 'Hot pepper', scientificName: 'Capsicum annuum', family: 'Solanaceae', genus: 'Capsicum',
      lifecycle: 'annual', daysToMaturity: 80, dtmFrom: 'transplant', spacingMm: inches(18), plantsPerCell: 1,
      sowMethod: 'transplant', feederClass: 'heavy', seedLongevityYears: 2 }),
  v({ id: 'cucumber', commonName: 'Cucumber', scientificName: 'Cucumis sativus', family: 'Cucurbitaceae', genus: 'Cucumis',
      lifecycle: 'annual', daysToMaturity: 58, spacingMm: inches(12), plantsPerCell: 2, sowMethod: 'either',
      feederClass: 'heavy', seedLongevityYears: 5 }),
  v({ id: 'zucchini', commonName: 'Zucchini', scientificName: 'Cucurbita pepo', family: 'Cucurbitaceae', genus: 'Cucurbita',
      lifecycle: 'annual', daysToMaturity: 50, spacingMm: inches(24), plantsPerCell: 0.5, matureSpreadMm: feet(3),
      feederClass: 'heavy', seedLongevityYears: 5 }),
  v({ id: 'winter-squash', commonName: 'Winter squash', scientificName: 'Cucurbita maxima', family: 'Cucurbitaceae', genus: 'Cucurbita',
      lifecycle: 'annual', daysToMaturity: 100, spacingMm: inches(36), plantsPerCell: 0.25, matureSpreadMm: feet(6),
      feederClass: 'heavy', seedLongevityYears: 5 }),
  v({ id: 'bean-bush', commonName: 'Bush bean', scientificName: 'Phaseolus vulgaris', family: 'Fabaceae', genus: 'Phaseolus',
      lifecycle: 'annual', daysToMaturity: 55, spacingMm: inches(4), plantsPerCell: 9, feederClass: 'fixer' }),
  v({ id: 'bean-pole', commonName: 'Pole bean', scientificName: 'Phaseolus vulgaris', family: 'Fabaceae', genus: 'Phaseolus',
      lifecycle: 'annual', daysToMaturity: 65, spacingMm: inches(6), plantsPerCell: 8, matureHeightMm: feet(8),
      feederClass: 'fixer' }),
  v({ id: 'pea', commonName: 'Pea', scientificName: 'Pisum sativum', family: 'Fabaceae', genus: 'Pisum',
      lifecycle: 'annual', daysToMaturity: 60, spacingMm: inches(3), plantsPerCell: 8, frostTolerance: 'hardy',
      feederClass: 'fixer' }),
  v({ id: 'lettuce', commonName: 'Lettuce', scientificName: 'Lactuca sativa', family: 'Asteraceae', genus: 'Lactuca',
      lifecycle: 'annual', daysToMaturity: 50, spacingMm: inches(6), plantsPerCell: 4, sunRequirement: 'partial',
      frostTolerance: 'halfHardy', feederClass: 'light', seedLongevityYears: 5,
      notes: 'Morning sun with afternoon shade beats six hours of either.' }),
  v({ id: 'spinach', commonName: 'Spinach', scientificName: 'Spinacia oleracea', family: 'Amaranthaceae', genus: 'Spinacia',
      lifecycle: 'annual', daysToMaturity: 40, spacingMm: inches(4), plantsPerCell: 9, sunRequirement: 'partial',
      frostTolerance: 'veryHardy', feederClass: 'moderate', seedLongevityYears: 3 }),
  v({ id: 'kale', commonName: 'Kale', scientificName: 'Brassica oleracea', family: 'Brassicaceae', genus: 'Brassica',
      lifecycle: 'biennial', daysToMaturity: 55, dtmFrom: 'transplant', spacingMm: inches(12), plantsPerCell: 1,
      sowMethod: 'either', frostTolerance: 'veryHardy', feederClass: 'heavy', seedLongevityYears: 4 }),
  v({ id: 'chard', commonName: 'Swiss chard', scientificName: 'Beta vulgaris', family: 'Amaranthaceae', genus: 'Beta',
      lifecycle: 'biennial', daysToMaturity: 55, spacingMm: inches(8), plantsPerCell: 4, frostTolerance: 'hardy',
      seedLongevityYears: 4 }),
  v({ id: 'carrot', commonName: 'Carrot', scientificName: 'Daucus carota', family: 'Apiaceae', genus: 'Daucus',
      lifecycle: 'biennial', daysToMaturity: 70, spacingMm: inches(3), plantsPerCell: 16, frostTolerance: 'hardy',
      feederClass: 'light' }),
  v({ id: 'beet', commonName: 'Beetroot', scientificName: 'Beta vulgaris', family: 'Amaranthaceae', genus: 'Beta',
      lifecycle: 'biennial', daysToMaturity: 55, spacingMm: inches(4), plantsPerCell: 9, frostTolerance: 'hardy',
      seedLongevityYears: 4 }),
  v({ id: 'radish', commonName: 'Radish', scientificName: 'Raphanus sativus', family: 'Brassicaceae', genus: 'Raphanus',
      lifecycle: 'annual', daysToMaturity: 28, spacingMm: inches(2), plantsPerCell: 16, frostTolerance: 'hardy',
      feederClass: 'light', seedLongevityYears: 4 }),
  v({ id: 'onion', commonName: 'Onion', scientificName: 'Allium cepa', family: 'Amaryllidaceae', genus: 'Allium',
      lifecycle: 'biennial', daysToMaturity: 100, dtmFrom: 'transplant', spacingMm: inches(4), plantsPerCell: 9,
      sowMethod: 'transplant', frostTolerance: 'hardy', seedLongevityYears: 1,
      notes: 'Onion seed is the shortest-lived in the box — one year, reliably.' }),
  v({ id: 'garlic', commonName: 'Garlic', scientificName: 'Allium sativum', family: 'Amaryllidaceae', genus: 'Allium',
      lifecycle: 'bulb', daysToMaturity: 240, spacingMm: inches(6), plantsPerCell: 4, sowMethod: 'bareRoot',
      frostTolerance: 'veryHardy', hardinessZoneMin: '3', hardinessZoneMax: '9', seedLongevityYears: 1 }),
  v({ id: 'potato', commonName: 'Potato', scientificName: 'Solanum tuberosum', family: 'Solanaceae', genus: 'Solanum',
      lifecycle: 'annual', daysToMaturity: 90, spacingMm: inches(12), plantsPerCell: 1, sowMethod: 'bareRoot',
      feederClass: 'heavy', seedLongevityYears: 1 }),
  v({ id: 'sweet-corn', commonName: 'Sweet corn', scientificName: 'Zea mays', family: 'Poaceae', genus: 'Zea',
      lifecycle: 'annual', daysToMaturity: 80, spacingMm: inches(8), plantsPerCell: 4, matureHeightMm: feet(7),
      feederClass: 'heavy', seedLongevityYears: 2 }),
  v({ id: 'broccoli', commonName: 'Broccoli', scientificName: 'Brassica oleracea', family: 'Brassicaceae', genus: 'Brassica',
      lifecycle: 'annual', daysToMaturity: 60, dtmFrom: 'transplant', spacingMm: inches(18), plantsPerCell: 1,
      sowMethod: 'transplant', frostTolerance: 'hardy', feederClass: 'heavy', seedLongevityYears: 4 }),
  v({ id: 'cabbage', commonName: 'Cabbage', scientificName: 'Brassica oleracea', family: 'Brassicaceae', genus: 'Brassica',
      lifecycle: 'biennial', daysToMaturity: 70, dtmFrom: 'transplant', spacingMm: inches(18), plantsPerCell: 1,
      sowMethod: 'transplant', frostTolerance: 'hardy', feederClass: 'heavy', seedLongevityYears: 4 }),
  v({ id: 'basil', commonName: 'Basil', scientificName: 'Ocimum basilicum', family: 'Lamiaceae', genus: 'Ocimum',
      lifecycle: 'annual', daysToMaturity: 60, dtmFrom: 'transplant', spacingMm: inches(10), plantsPerCell: 2,
      sowMethod: 'either', feederClass: 'moderate', seedLongevityYears: 4 }),
  v({ id: 'dill', commonName: 'Dill', scientificName: 'Anethum graveolens', family: 'Apiaceae', genus: 'Anethum',
      lifecycle: 'annual', daysToMaturity: 45, spacingMm: inches(8), plantsPerCell: 4, feederClass: 'light',
      seedLongevityYears: 3, pollinatorValue: 'high',
      notes: 'An umbellifer — its flowers feed parasitoid wasps and hoverflies.' }),
  v({ id: 'cilantro', commonName: 'Cilantro', scientificName: 'Coriandrum sativum', family: 'Apiaceae', genus: 'Coriandrum',
      lifecycle: 'annual', daysToMaturity: 45, spacingMm: inches(6), plantsPerCell: 4, sunRequirement: 'partial',
      frostTolerance: 'halfHardy', feederClass: 'light', pollinatorValue: 'high' }),
  v({ id: 'parsley', commonName: 'Parsley', scientificName: 'Petroselinum crispum', family: 'Apiaceae', genus: 'Petroselinum',
      lifecycle: 'biennial', daysToMaturity: 75, dtmFrom: 'transplant', spacingMm: inches(8), plantsPerCell: 4,
      sowMethod: 'transplant', frostTolerance: 'hardy', feederClass: 'light', seedLongevityYears: 2 }),
  v({ id: 'strawberry', commonName: 'Strawberry', scientificName: 'Fragaria × ananassa', family: 'Rosaceae', genus: 'Fragaria',
      lifecycle: 'perennial', daysToMaturity: 300, spacingMm: inches(12), plantsPerCell: 1, sowMethod: 'bareRoot',
      hardinessZoneMin: '4', hardinessZoneMax: '9', frostTolerance: 'hardy', seedLongevityYears: 2 }),
  v({ id: 'blueberry', commonName: 'Blueberry', scientificName: 'Vaccinium corymbosum', family: 'Ericaceae', genus: 'Vaccinium',
      lifecycle: 'shrub', spacingMm: feet(4), matureSpreadMm: feet(5), matureHeightMm: feet(6), sowMethod: 'bareRoot',
      hardinessZoneMin: '4', hardinessZoneMax: '8', moisture: 'moist', frostTolerance: 'veryHardy',
      nativeToRegions: [...IN_NATIVE], pollinatorValue: 'high', seedLongevityYears: 2,
      notes: 'Wants acid soil — the one crop here that will not tolerate ordinary ground.' }),
];

/* --------------------------------------------------------------- natives */

const natives: Variety[] = [
  v({ id: 'echinacea-purpurea', commonName: 'Purple coneflower', scientificName: 'Echinacea purpurea',
      family: 'Asteraceae', genus: 'Echinacea', lifecycle: 'perennial', spacingMm: inches(18),
      matureHeightMm: feet(4), hardinessZoneMin: '3', hardinessZoneMax: '8', sowMethod: 'either',
      frostTolerance: 'veryHardy', bloomStartMonth: 6, bloomEndMonth: 9, nativeToRegions: [...IN_NATIVE],
      pollinatorValue: 'high', seedLongevityYears: 3 }),
  v({ id: 'rudbeckia-hirta', commonName: 'Black-eyed Susan', scientificName: 'Rudbeckia hirta',
      family: 'Asteraceae', genus: 'Rudbeckia', lifecycle: 'biennial', spacingMm: inches(15),
      matureHeightMm: feet(3), hardinessZoneMin: '3', hardinessZoneMax: '9', frostTolerance: 'veryHardy',
      bloomStartMonth: 6, bloomEndMonth: 10, nativeToRegions: [...IN_NATIVE], pollinatorValue: 'high' }),
  v({ id: 'asclepias-syriaca', commonName: 'Common milkweed', scientificName: 'Asclepias syriaca',
      family: 'Apocynaceae', genus: 'Asclepias', lifecycle: 'perennial', spacingMm: inches(24),
      matureHeightMm: feet(5), hardinessZoneMin: '3', hardinessZoneMax: '9', frostTolerance: 'veryHardy',
      bloomStartMonth: 6, bloomEndMonth: 8, nativeToRegions: [...IN_NATIVE], pollinatorValue: 'high',
      hostGenera: ['Danaus'], seedLongevityYears: 3, notes: 'Spreads by rhizome — give it room or a border it cannot cross.' }),
  v({ id: 'asclepias-tuberosa', commonName: 'Butterfly weed', scientificName: 'Asclepias tuberosa',
      family: 'Apocynaceae', genus: 'Asclepias', lifecycle: 'perennial', spacingMm: inches(18),
      matureHeightMm: feet(2.5), hardinessZoneMin: '3', hardinessZoneMax: '9', moisture: 'dry',
      frostTolerance: 'veryHardy', bloomStartMonth: 6, bloomEndMonth: 8, nativeToRegions: [...IN_NATIVE],
      pollinatorValue: 'high', hostGenera: ['Danaus'] }),
  v({ id: 'asclepias-incarnata', commonName: 'Swamp milkweed', scientificName: 'Asclepias incarnata',
      family: 'Apocynaceae', genus: 'Asclepias', lifecycle: 'perennial', spacingMm: inches(24),
      matureHeightMm: feet(4), hardinessZoneMin: '3', hardinessZoneMax: '9', moisture: 'wet',
      frostTolerance: 'veryHardy', bloomStartMonth: 7, bloomEndMonth: 8, nativeToRegions: [...IN_NATIVE],
      pollinatorValue: 'high', hostGenera: ['Danaus'] }),
  v({ id: 'monarda-fistulosa', commonName: 'Wild bergamot', scientificName: 'Monarda fistulosa',
      family: 'Lamiaceae', genus: 'Monarda', lifecycle: 'perennial', spacingMm: inches(18),
      matureHeightMm: feet(4), hardinessZoneMin: '3', hardinessZoneMax: '9', moisture: 'dry',
      frostTolerance: 'veryHardy', bloomStartMonth: 7, bloomEndMonth: 9, nativeToRegions: [...IN_NATIVE],
      pollinatorValue: 'high' }),
  v({ id: 'symphyotrichum-novae-angliae', commonName: 'New England aster',
      scientificName: 'Symphyotrichum novae-angliae', family: 'Asteraceae', genus: 'Symphyotrichum',
      lifecycle: 'perennial', spacingMm: inches(24), matureHeightMm: feet(5), hardinessZoneMin: '4',
      hardinessZoneMax: '8', frostTolerance: 'veryHardy', bloomStartMonth: 8, bloomEndMonth: 10,
      nativeToRegions: [...IN_NATIVE], pollinatorValue: 'high',
      notes: 'Late bloom — often the only thing flowering when it matters most.' }),
  v({ id: 'liatris-pycnostachya', commonName: 'Prairie blazing star', scientificName: 'Liatris pycnostachya',
      family: 'Asteraceae', genus: 'Liatris', lifecycle: 'perennial', spacingMm: inches(15),
      matureHeightMm: feet(4), hardinessZoneMin: '3', hardinessZoneMax: '9', frostTolerance: 'veryHardy',
      bloomStartMonth: 7, bloomEndMonth: 9, nativeToRegions: [...IN_NATIVE], pollinatorValue: 'high' }),
  v({ id: 'schizachyrium-scoparium', commonName: 'Little bluestem', scientificName: 'Schizachyrium scoparium',
      family: 'Poaceae', genus: 'Schizachyrium', lifecycle: 'perennial', spacingMm: inches(18),
      matureHeightMm: feet(3), hardinessZoneMin: '3', hardinessZoneMax: '9', moisture: 'dry',
      frostTolerance: 'veryHardy', nativeToRegions: [...IN_NATIVE], hostGenera: ['Hesperia', 'Amblyscirtes'] }),
  v({ id: 'zizia-aurea', commonName: 'Golden alexanders', scientificName: 'Zizia aurea',
      family: 'Apiaceae', genus: 'Zizia', lifecycle: 'perennial', spacingMm: inches(15),
      matureHeightMm: feet(2.5), hardinessZoneMin: '3', hardinessZoneMax: '8', sunRequirement: 'partial',
      frostTolerance: 'veryHardy', bloomStartMonth: 4, bloomEndMonth: 6, nativeToRegions: [...IN_NATIVE],
      pollinatorValue: 'high', hostGenera: ['Papilio'],
      notes: 'One of the earliest native nectar sources — fills the April gap.' }),
  v({ id: 'lobelia-cardinalis', commonName: 'Cardinal flower', scientificName: 'Lobelia cardinalis',
      family: 'Campanulaceae', genus: 'Lobelia', lifecycle: 'perennial', spacingMm: inches(12),
      matureHeightMm: feet(4), hardinessZoneMin: '3', hardinessZoneMax: '9', moisture: 'wet',
      sunRequirement: 'partial', frostTolerance: 'veryHardy', bloomStartMonth: 7, bloomEndMonth: 9,
      nativeToRegions: [...IN_NATIVE], pollinatorValue: 'high' }),
  v({ id: 'aquilegia-canadensis', commonName: 'Wild columbine', scientificName: 'Aquilegia canadensis',
      family: 'Ranunculaceae', genus: 'Aquilegia', lifecycle: 'perennial', spacingMm: inches(12),
      matureHeightMm: feet(2.5), hardinessZoneMin: '3', hardinessZoneMax: '8', sunRequirement: 'partial',
      frostTolerance: 'veryHardy', bloomStartMonth: 4, bloomEndMonth: 6, nativeToRegions: [...IN_NATIVE],
      pollinatorValue: 'high' }),
  v({ id: 'penstemon-digitalis', commonName: 'Foxglove beardtongue', scientificName: 'Penstemon digitalis',
      family: 'Plantaginaceae', genus: 'Penstemon', lifecycle: 'perennial', spacingMm: inches(15),
      matureHeightMm: feet(3.5), hardinessZoneMin: '3', hardinessZoneMax: '8', frostTolerance: 'veryHardy',
      bloomStartMonth: 5, bloomEndMonth: 7, nativeToRegions: [...IN_NATIVE], pollinatorValue: 'high' }),
  v({ id: 'eryngium-yuccifolium', commonName: 'Rattlesnake master', scientificName: 'Eryngium yuccifolium',
      family: 'Apiaceae', genus: 'Eryngium', lifecycle: 'perennial', spacingMm: inches(18),
      matureHeightMm: feet(4), hardinessZoneMin: '4', hardinessZoneMax: '9', moisture: 'dry',
      frostTolerance: 'veryHardy', bloomStartMonth: 7, bloomEndMonth: 8, nativeToRegions: [...IN_NATIVE],
      pollinatorValue: 'high' }),
  v({ id: 'solidago-speciosa', commonName: 'Showy goldenrod', scientificName: 'Solidago speciosa',
      family: 'Asteraceae', genus: 'Solidago', lifecycle: 'perennial', spacingMm: inches(18),
      matureHeightMm: feet(4), hardinessZoneMin: '3', hardinessZoneMax: '8', moisture: 'dry',
      frostTolerance: 'veryHardy', bloomStartMonth: 8, bloomEndMonth: 10, nativeToRegions: [...IN_NATIVE],
      pollinatorValue: 'high' }),
  v({ id: 'amelanchier-arborea', commonName: 'Downy serviceberry', scientificName: 'Amelanchier arborea',
      family: 'Rosaceae', genus: 'Amelanchier', lifecycle: 'tree', spacingMm: feet(15),
      matureSpreadMm: feet(15), matureHeightMm: feet(25), hardinessZoneMin: '4', hardinessZoneMax: '9',
      sowMethod: 'bareRoot', sunRequirement: 'partial', frostTolerance: 'veryHardy',
      bloomStartMonth: 4, bloomEndMonth: 4, nativeToRegions: [...IN_NATIVE], pollinatorValue: 'high' }),
  v({ id: 'cephalanthus-occidentalis', commonName: 'Buttonbush', scientificName: 'Cephalanthus occidentalis',
      family: 'Rubiaceae', genus: 'Cephalanthus', lifecycle: 'shrub', spacingMm: feet(6),
      matureSpreadMm: feet(8), matureHeightMm: feet(10), hardinessZoneMin: '5', hardinessZoneMax: '9',
      moisture: 'wet', sowMethod: 'bareRoot', frostTolerance: 'veryHardy', bloomStartMonth: 6,
      bloomEndMonth: 8, nativeToRegions: [...IN_NATIVE], pollinatorValue: 'high' }),
  v({ id: 'physocarpus-opulifolius', commonName: 'Ninebark', scientificName: 'Physocarpus opulifolius',
      family: 'Rosaceae', genus: 'Physocarpus', lifecycle: 'shrub', spacingMm: feet(6),
      matureSpreadMm: feet(7), matureHeightMm: feet(8), hardinessZoneMin: '2', hardinessZoneMax: '8',
      sowMethod: 'bareRoot', frostTolerance: 'veryHardy', bloomStartMonth: 5, bloomEndMonth: 6,
      nativeToRegions: [...IN_NATIVE], pollinatorValue: 'medium' }),
];

export const BUNDLED_CATALOG: readonly Variety[] = [...vegetables, ...natives];

export const varietyById = (id: string): Variety | undefined =>
  BUNDLED_CATALOG.find((variety) => variety.id === id);
