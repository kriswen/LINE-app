// Weather fetching utility using Open-Meteo API

const WEATHER_API_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=25.0478&longitude=121.5319&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTaipei&forecast_days=1';

export async function fetchTaipeiWeather() {
  let weatherData = null;
  let attempts = 0;

  while (attempts < 3 && !weatherData) {
    try {
      const response = await fetch(WEATHER_API_URL, {
        headers: { 'User-Agent': 'LINE-Bot/1.0' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      weatherData = await response.json();
    } catch (error) {
      attempts++;
      console.log(`Weather fetch failed (Attempt ${attempts}/3):`, error);
      if (attempts < 3) {
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
  }

  if (weatherData && weatherData.daily) {
    const high = weatherData.daily.temperature_2m_max[0];
    const low = weatherData.daily.temperature_2m_min[0];
    const avgTemp = ((high + low) / 2).toFixed(1);
    const rainChance = weatherData.daily.precipitation_probability_max[0];

    return { avgTemp, rainChance };
  }

  console.log('Failed to fetch weather after 3 attempts');
  return null;
}