export const REGIONS = {
  kyiv: {
    name: 'Київ',
    code: 'kyiv',
  },
  'kyiv-region': {
    name: 'Київщина',
    code: 'kyiv-region',
  },
  dnipro: {
    name: 'Дніпропетровщина',
    code: 'dnipro',
  },
  odesa: {
    name: 'Одещина',
    code: 'odesa',
  },
};

export const GROUPS = [1, 2, 3, 4, 5, 6];
export const SUBGROUPS = [1, 2];

export const QUEUES = [];
GROUPS.forEach(group => {
  SUBGROUPS.forEach(subgroup => {
    QUEUES.push(`${group}.${subgroup}`);
  });
});

export const REGION_CODES = Object.keys(REGIONS);

export const DATA_URL_TEMPLATE = 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/{region}.json';
export const IMAGE_URL_TEMPLATE = 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/{region}/gpv-{queue}-emergency.png';

export const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
export const PENDING_CHANNEL_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes
export const CHANNEL_NAME_PREFIX = 'Вольтик ⚡️ ';
