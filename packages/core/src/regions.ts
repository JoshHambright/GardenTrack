import type { RegionRef } from './model.js';

/**
 * Regions a gardener can name for themselves (P2-03).
 *
 * A US state is what nativity data is published against, and picking one from a
 * list is not a location disclosure in any meaningful sense — Indiana holds
 * nearly seven million people. It is also the minimum the catalog needs: without
 * a region, every "native here" claim is false, because there is nothing for it
 * to be true *of*.
 *
 * EPA Level III ecoregions are the better scale and cannot be derived offline
 * without bundling boundary polygons, so the ones listed here are those a
 * gardener might reasonably recognise, offered rather than inferred.
 */

export const US_STATES: ReadonlyArray<{ code: string; name: string }> = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'],
  ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'],
  ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'],
  ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'],
  ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
].map(([code, name]) => ({ code: code as string, name: name as string }));

/** EPA Level III ecoregions covered by the bundled catalog so far. */
export const ECOREGIONS: ReadonlyArray<{ code: string; name: string }> = [
  { code: '55', name: 'Eastern Corn Belt Plains' },
  { code: '54', name: 'Central Corn Belt Plains' },
  { code: '72', name: 'Interior River Valleys and Hills' },
  { code: '71', name: 'Interior Plateau' },
];

export const stateRegion = (code: string): RegionRef | null => {
  const found = US_STATES.find((s) => s.code === code);
  return found === null || found === undefined
    ? null
    : { kind: 'state', code: found.code, name: found.name };
};

export const ecoregionRegion = (code: string): RegionRef | null => {
  const found = ECOREGIONS.find((r) => r.code === code);
  return found === undefined ? null : { kind: 'ecoregion3', code: found.code, name: found.name };
};
