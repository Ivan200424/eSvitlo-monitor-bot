// Schedule API service - fetches schedule data from GitHub
import axios from 'axios';
import { DATA_URL_TEMPLATE, IMAGE_URL_TEMPLATE, CACHE_TTL } from '../config/constants.js';

const cache = new Map();

async function fetchWithRetry(url, retries = 3, isImage = false) {
  const delays = [5000, 15000, 45000];
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        responseType: isImage ? 'arraybuffer' : 'json',
        headers: {
          'User-Agent': 'Voltyk-Bot/2.0',
        },
      });
      return response.data;
    } catch (error) {
      const isLastRetry = i === retries - 1;
      
      if (isLastRetry) {
        throw new Error(`Failed to fetch ${url} after ${retries} attempts: ${error.message}`);
      }
      
      const delay = delays[i] || delays[delays.length - 1];
      console.log(`Retry ${i + 1}/${retries} for ${url} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function getDataUrl(region) {
  return DATA_URL_TEMPLATE.replace('{region}', region);
}

function getImageUrl(region, queue) {
  return IMAGE_URL_TEMPLATE
    .replace('{region}', region)
    .replace('{queue}', queue.replace('.', '-'));
}

export async function fetchScheduleData(region) {
  const cacheKey = `schedule_${region}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const url = getDataUrl(region);
    const data = await fetchWithRetry(url, 3, false);
    
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
    
    return data;
  } catch (error) {
    console.error(`Помилка отримання даних для ${region}:`, error.message);
    
    if (cached) {
      console.log(`Використання застарілих даних з кешу для ${region}`);
      return cached.data;
    }
    
    throw error;
  }
}

export async function fetchScheduleImage(region, queue) {
  const cacheKey = `image_${region}_${queue}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const url = getImageUrl(region, queue);
    const data = await fetchWithRetry(url, 3, true);
    
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
    
    return data;
  } catch (error) {
    console.error(`Помилка отримання зображення для ${region}/${queue}:`, error.message);
    
    if (cached) {
      console.log(`Використання застарілого зображення з кешу для ${region}/${queue}`);
      return cached.data;
    }
    
    throw error;
  }
}

export function clearCache() {
  cache.clear();
}
