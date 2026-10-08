export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type:
    | 'SPIKE'
    | 'DOUBLE_SPIKE'
    | 'TRIPLE_SPIKE'
    | 'BLOCK'
    | 'PAD'
    | 'ORB'
    | 'PORTAL_ROCKET'
    | 'PORTAL_CUBE'
    | 'PORTAL_WAVE'
    | 'SPEED_1X'
    | 'SPEED_2X'
    | 'SPEED_3X'
    | 'FINISH';
  triggered?: boolean;
}

export interface LevelConfig {
  id: number;
  name: string;
  difficulty: 'Kolay' | 'Normal' | 'Zor' | 'İleri Seviye' | 'Uzman' | 'Usta' | 'Şeytani' | 'Kabus' | 'İmkansız' | 'Efsane';
  desc: string;
  speed: number;
  accent: string;
  length: number;
  obstacles: Obstacle[];
}

const GROUND_Y = 380;
// Perfect jump trajectory constants:
// When cube jumps from ground, apex is reached ~17-18 frames later (~100-115px up from ground).
// Ideal Orb placement is 70-85px above ground and positioned ~180-220px AFTER the jump point,
// with spikes safely placed underneath so landing happens comfortably on the other side.
const ORB_Y = GROUND_Y - 72;

export const GD_LEVELS: LevelConfig[] = [
  // Level 1: Kolay / Başlangıç
  {
    id: 0,
    name: '01. Stereo Akış',
    difficulty: 'Kolay',
    desc: 'Tekli dikenler ve temel trambolin alıştırması. Ritmik zıplamayı keşfet.',
    speed: 5.8,
    accent: '#3B82F6',
    length: 4200,
    obstacles: [
      { x: 500, y: GROUND_Y - 36, w: 34, h: 36, type: 'SPIKE' },
      { x: 800, y: GROUND_Y - 36, w: 34, h: 36, type: 'SPIKE' },
      { x: 1100, y: GROUND_Y - 42, w: 90, h: 42, type: 'BLOCK' },
      { x: 1300, y: GROUND_Y - 84, w: 90, h: 84, type: 'BLOCK' },
      { x: 1600, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 1740, y: GROUND_Y - 36, w: 34, h: 36, type: 'SPIKE' },
      { x: 2040, y: GROUND_Y - 36, w: 34, h: 36, type: 'SPIKE' },
      { x: 2300, y: GROUND_Y - 45, w: 95, h: 45, type: 'BLOCK' },
      { x: 2500, y: GROUND_Y - 85, w: 95, h: 85, type: 'BLOCK' },
      { x: 2800, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 2950, y: GROUND_Y - 36, w: 34, h: 36, type: 'SPIKE' },
      { x: 3250, y: GROUND_Y - 45, w: 90, h: 45, type: 'BLOCK' },
      { x: 3550, y: GROUND_Y - 36, w: 34, h: 36, type: 'SPIKE' },
      { x: 3850, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 4000, y: GROUND_Y - 36, w: 34, h: 36, type: 'SPIKE' },
      { x: 4200, y: 40, w: 30, h: GROUND_Y - 40, type: 'FINISH' },
    ],
  },

  // Level 2: Normal / Kusursuz Orb Hizalaması
  {
    id: 1,
    name: '02. Neon Nabız',
    difficulty: 'Normal',
    desc: 'Hava halkaları (Orblar) devreye giriyor. Havada orba dokunup zıpla!',
    speed: 6.3,
    accent: '#06B6D4',
    length: 4600,
    obstacles: [
      { x: 480, y: GROUND_Y - 36, w: 34, h: 36, type: 'SPIKE' },
      { x: 760, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 1060, y: GROUND_Y - 42, w: 90, h: 42, type: 'BLOCK' },
      { x: 1260, y: GROUND_Y - 84, w: 90, h: 84, type: 'BLOCK' },
      { x: 1560, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 1700, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      // Natural jump orb: Player jumps ~1900, reaches orb at 2080 at peak arc
      { x: 2080, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 2150, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 2450, y: GROUND_Y - 45, w: 100, h: 45, type: 'BLOCK' },
      { x: 2750, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 2900, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      // Second comfortable orb
      { x: 3200, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 3270, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3550, y: GROUND_Y - 45, w: 90, h: 45, type: 'BLOCK' },
      { x: 3750, y: GROUND_Y - 90, w: 90, h: 90, type: 'BLOCK' },
      { x: 4050, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4320, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 4460, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4600, y: 40, w: 30, h: GROUND_Y - 40, type: 'FINISH' },
    ],
  },

  // Level 3: Zor / Roket Portalı ile Tanışma
  {
    id: 2,
    name: '03. Roket Tüneli',
    difficulty: 'Zor',
    desc: 'Pembe portaldan geçerek rokete dönüş. Basılı tutarak süzül!',
    speed: 6.8,
    accent: '#10B981',
    length: 5000,
    obstacles: [
      { x: 460, y: GROUND_Y - 36, w: 34, h: 36, type: 'SPIKE' },
      { x: 740, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 880, y: GROUND_Y - 80, w: 100, h: 80, type: 'BLOCK' },
      { x: 1180, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_ROCKET' },
      // Roket bölümü (ferah ve akıcı koridor: 140px geçit)
      { x: 1540, y: 55, w: 80, h: 90, type: 'BLOCK' },
      { x: 1840, y: GROUND_Y - 95, w: 80, h: 95, type: 'BLOCK' },
      { x: 2160, y: 55, w: 80, h: 90, type: 'BLOCK' },
      { x: 2460, y: GROUND_Y - 95, w: 80, h: 95, type: 'BLOCK' },
      { x: 2760, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_CUBE' },
      // Küp bölümü
      { x: 3060, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 3200, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3480, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 3560, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3850, y: GROUND_Y - 45, w: 90, h: 45, type: 'BLOCK' },
      { x: 4050, y: GROUND_Y - 90, w: 90, h: 90, type: 'BLOCK' },
      { x: 4350, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 4490, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4800, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5000, y: 40, w: 30, h: GROUND_Y - 40, type: 'FINISH' },
    ],
  },

  // Level 4: İleri Seviye / Ritim ve Çift Orb
  {
    id: 3,
    name: '04. Çift Orb Zinciri',
    difficulty: 'İleri Seviye',
    desc: 'Art arda yerleştirilmiş orblar. Havada ritmik çift tıkla engelleri aş.',
    speed: 7.2,
    accent: '#6366F1',
    length: 5200,
    obstacles: [
      { x: 450, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 750, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 900, y: GROUND_Y - 85, w: 90, h: 85, type: 'BLOCK' },
      // Sequential chain of 2 comfortable orbs
      { x: 1220, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 1290, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 1520, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 1590, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 1880, y: GROUND_Y - 45, w: 90, h: 45, type: 'BLOCK' },
      { x: 2080, y: GROUND_Y - 95, w: 90, h: 95, type: 'BLOCK' },
      { x: 2360, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 2500, y: GROUND_Y - 36, w: 102, h: 36, type: 'TRIPLE_SPIKE' },
      { x: 2820, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 2900, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3180, y: GROUND_Y - 45, w: 90, h: 45, type: 'BLOCK' },
      { x: 3380, y: GROUND_Y - 95, w: 90, h: 95, type: 'BLOCK' },
      { x: 3680, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 3820, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4120, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 4200, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4480, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 4620, y: GROUND_Y - 36, w: 102, h: 36, type: 'TRIPLE_SPIKE' },
      { x: 4920, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5200, y: 40, w: 30, h: GROUND_Y - 40, type: 'FINISH' },
    ],
  },

  // Level 5: Uzman / Hız Artışı ve Dengeli Roket Tüneli
  {
    id: 4,
    name: '05. Hiper Dalga',
    difficulty: 'Uzman',
    desc: 'Daha yüksek hız, akıcı roket geçitleri ve hızlı karar anları.',
    speed: 7.2,
    accent: '#8B5CF6',
    length: 5300,
    obstacles: [
      { x: 440, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 740, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 880, y: GROUND_Y - 80, w: 90, h: 80, type: 'BLOCK' },
      { x: 1200, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 1280, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 1540, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_ROCKET' },
      // Ferah roket tüneli (130px geçiş payı)
      { x: 1840, y: 55, w: 80, h: 95, type: 'BLOCK' },
      { x: 2140, y: GROUND_Y - 100, w: 80, h: 100, type: 'BLOCK' },
      { x: 2440, y: 55, w: 80, h: 95, type: 'BLOCK' },
      { x: 2740, y: GROUND_Y - 100, w: 80, h: 100, type: 'BLOCK' },
      { x: 3040, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_CUBE' },
      // Küp geçişi
      { x: 3340, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 3480, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3780, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 3860, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4140, y: GROUND_Y - 45, w: 90, h: 45, type: 'BLOCK' },
      { x: 4340, y: GROUND_Y - 90, w: 90, h: 90, type: 'BLOCK' },
      { x: 4640, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 4780, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5080, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 5300, y: 40, w: 30, h: GROUND_Y - 40, type: 'FINISH' },
    ],
  },

  // Level 6: Usta / Üçlü Dikenler ve Blok Atlama
  {
    id: 5,
    name: '06. Siber Geometri',
    difficulty: 'Usta',
    desc: 'Hassas üçlü dikenler ve bloktan bloğa sıçrayış.',
    speed: 7.5,
    accent: '#EC4899',
    length: 5400,
    obstacles: [
      { x: 430, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 740, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 880, y: GROUND_Y - 85, w: 95, h: 85, type: 'BLOCK' },
      { x: 1080, y: GROUND_Y - 130, w: 95, h: 130, type: 'BLOCK' },
      { x: 1380, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 1720, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 1800, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 2080, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 2160, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 2460, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 2600, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 2900, y: GROUND_Y - 45, w: 90, h: 45, type: 'BLOCK' },
      { x: 3100, y: GROUND_Y - 90, w: 90, h: 90, type: 'BLOCK' },
      { x: 3400, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 3540, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3860, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 3940, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4240, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 4380, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4700, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 4780, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5080, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5400, y: 40, w: 30, h: GROUND_Y - 40, type: 'FINISH' },
    ],
  },

  // Level 7: Şeytani / Çift Roket Geçidi ve Yüksek Hız
  {
    id: 6,
    name: '07. Şeytani Koridor',
    difficulty: 'Şeytani',
    desc: 'İki kez roket modu geçişi. Refleks sınırlarını zorlayan koridorlar.',
    speed: 7.7,
    accent: '#F43F5E',
    length: 5600,
    obstacles: [
      { x: 420, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 720, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 860, y: GROUND_Y - 85, w: 90, h: 85, type: 'BLOCK' },
      { x: 1100, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_ROCKET' },
      // 1. Roket etabı (ferah 125px geçiş)
      { x: 1420, y: 55, w: 80, h: 100, type: 'BLOCK' },
      { x: 1720, y: GROUND_Y - 105, w: 80, h: 105, type: 'BLOCK' },
      { x: 2020, y: 55, w: 80, h: 100, type: 'BLOCK' },
      { x: 2320, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_CUBE' },
      // Orta Küp etabı
      { x: 2600, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 2740, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3040, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 3120, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3400, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_ROCKET' },
      // 2. Roket etabı
      { x: 3700, y: 55, w: 80, h: 100, type: 'BLOCK' },
      { x: 4000, y: GROUND_Y - 105, w: 80, h: 105, type: 'BLOCK' },
      { x: 4300, y: 55, w: 80, h: 100, type: 'BLOCK' },
      { x: 4600, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_CUBE' },
      // Final Küp etabı
      { x: 4880, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 5020, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5320, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 5400, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5600, y: 40, w: 30, h: GROUND_Y - 40, type: 'FINISH' },
    ],
  },

  // Level 8: Kabus / Ritmik Diken Fırtınası
  {
    id: 7,
    name: '08. Kabus Matrisi',
    difficulty: 'Kabus',
    desc: 'Hata payı az, ancak ritmi yakaladığında kusursuz akan parkur.',
    speed: 7.9,
    accent: '#EF4444',
    length: 5700,
    obstacles: [
      { x: 420, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 740, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 880, y: GROUND_Y - 85, w: 90, h: 85, type: 'BLOCK' },
      { x: 1220, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 1300, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 1580, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 1660, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 1960, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 2100, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 2400, y: GROUND_Y - 45, w: 90, h: 45, type: 'BLOCK' },
      { x: 2640, y: GROUND_Y - 90, w: 90, h: 90, type: 'BLOCK' },
      { x: 2940, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 3080, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3400, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 3480, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3780, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 3860, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4180, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 4320, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4640, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 4720, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5040, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 5180, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5460, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 5700, y: 40, w: 30, h: GROUND_Y - 40, type: 'FINISH' },
    ],
  },

  // Level 9: İmkansız / Yüksek Hız & Akıcı Roket Labirenti
  {
    id: 8,
    name: '09. İmkansız Sektör',
    difficulty: 'İmkansız',
    desc: 'Yüksek tempo, ardışık orblar ve adil geçişli roket boşlukları.',
    speed: 8.2,
    accent: '#DC2626',
    length: 5900,
    obstacles: [
      { x: 400, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 700, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 840, y: GROUND_Y - 85, w: 90, h: 85, type: 'BLOCK' },
      { x: 1180, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 1260, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 1540, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_ROCKET' },
      // Akıcı ve geçilebilir roket geçidi (120px açık koridor)
      { x: 1840, y: 55, w: 75, h: 105, type: 'BLOCK' },
      { x: 2120, y: GROUND_Y - 110, w: 75, h: 110, type: 'BLOCK' },
      { x: 2400, y: 55, w: 75, h: 105, type: 'BLOCK' },
      { x: 2680, y: GROUND_Y - 110, w: 75, h: 110, type: 'BLOCK' },
      { x: 2960, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_CUBE' },
      // Hızlı küp parkuru
      { x: 3240, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 3380, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3700, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 3780, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4060, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 4140, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4440, y: GROUND_Y - 45, w: 90, h: 45, type: 'BLOCK' },
      { x: 4680, y: GROUND_Y - 90, w: 90, h: 90, type: 'BLOCK' },
      { x: 4980, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 5120, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5440, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 5520, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5740, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 5900, y: 40, w: 30, h: GROUND_Y - 40, type: 'FINISH' },
    ],
  },

  // Level 10: Efsane / Zirve Şampiyon Etabı
  {
    id: 9,
    name: '10. Efsanevi Kozmos',
    difficulty: 'Efsane',
    desc: 'Nihai refleks sınavı. Zor ama yüzde yüz geçilebilir usta etabı!',
    speed: 8.4,
    accent: '#9333EA',
    length: 6200,
    obstacles: [
      { x: 380, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 680, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 820, y: GROUND_Y - 85, w: 90, h: 85, type: 'BLOCK' },
      { x: 1140, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 1220, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 1520, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 1600, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 1880, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_ROCKET' },
      // Efsanevi roket koridoru (ferah 115px koridor)
      { x: 2180, y: 55, w: 75, h: 105, type: 'BLOCK' },
      { x: 2440, y: GROUND_Y - 110, w: 75, h: 110, type: 'BLOCK' },
      { x: 2700, y: 55, w: 75, h: 105, type: 'BLOCK' },
      { x: 2960, y: GROUND_Y - 110, w: 75, h: 110, type: 'BLOCK' },
      { x: 3240, y: GROUND_Y - 240, w: 40, h: 240, type: 'PORTAL_CUBE' },
      // Efsanevi küp koridoru
      { x: 3500, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 3640, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 3960, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 4040, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4340, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 4420, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 4720, y: GROUND_Y - 45, w: 90, h: 45, type: 'BLOCK' },
      { x: 4940, y: GROUND_Y - 90, w: 90, h: 90, type: 'BLOCK' },
      { x: 5240, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 5380, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 5700, y: ORB_Y, w: 34, h: 34, type: 'ORB' },
      { x: 5780, y: GROUND_Y - 36, w: 68, h: 36, type: 'DOUBLE_SPIKE' },
      { x: 6040, y: GROUND_Y - 14, w: 42, h: 14, type: 'PAD' },
      { x: 6200, y: 40, w: 30, h: GROUND_Y - 40, type: 'FINISH' },
    ],
  },
];
