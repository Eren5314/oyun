// Geometry Dash Cosmetics Configuration and Canvas Drawing Helpers

export interface CosmeticOption {
  id: string;
  name: string;
  desc: string;
  icon?: string;
}

export interface PlayerCosmetics {
  cubeSkin: string;
  shipSkin: string;
  waveSkin: string;
  primaryColor: string;
  secondaryColor: string;
  trailEffect: string;
  deathEffect: string;
}

export const CUBE_SKINS: CosmeticOption[] = [
  { id: 'cube-classic', name: 'Klasik Küp', desc: 'İkonik kare gözlü Geometry Dash küpü' },
  { id: 'cube-ninja', name: 'Siber Ninja', desc: 'Kırmızı alın bantlı ve keskin bakışlı ninja' },
  { id: 'cube-cyclops', name: 'Robot Siklop', desc: 'Tek parlayan fütüristik optik mercek' },
  { id: 'cube-creeper', name: 'Piksel Yaratık', desc: 'Pikselleşmiş retro yüz deseni' },
  { id: 'cube-cat', name: 'Siber Kedi', desc: 'Geometrik kulaklı sevimli neon kedi' },
  { id: 'cube-skull', name: 'Kuru Kafa', desc: 'Karanlık köşeli siber kurukafa' },
  { id: 'cube-fire', name: 'Alev İblisi', desc: 'Ateşli boynuzlar ve alev saçan gözler' },
  { id: 'cube-target', name: 'Hedef Kilit', desc: 'Merkezi hedef artı işareti deseni' },
  { id: 'cube-crown', name: 'Kraliyet Tacı', desc: 'Altın taçlı şampiyon küpü' },
  { id: 'cube-matrix', name: 'Matriks Kod', desc: 'Dijital devre ve matriks çizgileri' },
  { id: 'cube-demon', name: 'Hiper Canavar', desc: 'Tehlikeli dişler ve kızgın bakış' },
  { id: 'cube-glitch', name: 'Glitch / Parazit', desc: 'Kaymış boyutlu çift renkli parazit küp' },
  { id: 'cube-companion', name: 'Yoldaş Küpü', desc: 'Portal yoldaş küpü - ortada parlayan pembe kalp' },
  { id: 'cube-diamond', name: 'Pırlanta Kristal', desc: 'Çok yüzeyli elmas kesim prizma çekirdek' },
  { id: 'cube-samurai', name: 'Siber Samuray', desc: 'Altın kabuto boynuzlu savaşçı kaskı' },
  { id: 'cube-alien', name: 'Kozmik Uzaylı', desc: '3 parlayan optik göz ve siber antenler' },
  { id: 'cube-gold', name: '24K Saf Altın', desc: 'Parıldayan saf altın kaplama ve elmas gözler' },
  { id: 'cube-ghost', name: 'Ektoplazma Hayalet', desc: 'Karanlıkta parlayan neon hayalet silüeti' },
  { id: 'cube-mecha', name: 'Mecha Zırh', desc: 'Gundam tarzı fütüristik mekanik vizör' },
  { id: 'cube-vampire', name: 'Gece Lordu', desc: 'Kırmızı kanat uçları ve sivri vampir dişleri' },
];

export const SHIP_SKINS: CosmeticOption[] = [
  { id: 'ship-classic', name: 'Dart Roket', desc: 'Standart aerodinamik dart roket' },
  { id: 'ship-stealth', name: 'Hayalet Jet', desc: 'Keskin açılı siber gizlilik jeti' },
  { id: 'ship-cruiser', name: 'Ağır Kruvazör', desc: 'Çift iticili zırhlı uzay gemisi' },
  { id: 'ship-shark', name: 'Plazma Köpekbalığı', desc: 'Sırt yüzgeci ve keskin burun' },
  { id: 'ship-ufo', name: 'UFO Diski', desc: 'Plazma halkalı uçan daire kabini' },
  { id: 'ship-dragon', name: 'Ejder Kanadı', desc: 'Geniş kanatlı mistik ejder roketi' },
  { id: 'ship-phoenix', name: 'Anka Kuşu', desc: 'Alev kanatlı ve çift kuyruklu ateş kuşu' },
  { id: 'ship-cyberpunk', name: 'Siber Motor', desc: 'Çift neon motor podlu hız aracı' },
  { id: 'ship-sub', name: 'Derinlik Denizaltısı', desc: 'Periskop kuleli neon derin deniz aracı' },
  { id: 'ship-rocket', name: 'Retro Apollo', desc: 'Klasik çizgi roman üç kanatlı uzay roketi' },
];

export const WAVE_SKINS: CosmeticOption[] = [
  { id: 'wave-classic', name: 'Jilet Oku', desc: 'Standart kusursuz 45 derece sivri ok' },
  { id: 'wave-shuriken', name: 'Siber Şuriken', desc: 'Çift taraflı dönen jilet dalga ucu' },
  { id: 'wave-trident', name: 'Üç Dişli Mızrak', desc: '3 sivri bıçaklı keskin mızrak' },
  { id: 'wave-crystal', name: 'Elmas Prizma', desc: 'Yontulmuş çok yüzeyli kristal ok' },
  { id: 'wave-plasma', name: 'Plazma Çekirdek', desc: 'Parlayan reaktörlü enerji oku' },
  { id: 'wave-stealth', name: 'Delta Bıçak', desc: 'Süpersonik delta kanat ucu' },
  { id: 'wave-scythe', name: 'Neon Tırpan', desc: 'Karanlık ölüm meleyi hilal tırpan bıçağı' },
  { id: 'wave-laser', name: 'Çift Lazer', desc: 'İki paralel lazer huzmesi ve odak çekirdeği' },
  { id: 'wave-needle', name: 'Hipersonik İğne', desc: 'Ultra ince jilet uçlu aerodinamik iğne' },
  { id: 'wave-comet', name: 'Kozmik Kuyruklu Yıldız', desc: 'Parlayan küre gövdeli yıldız ucu' },
];

export const PRIMARY_COLORS = [
  { id: '#3B82F6', name: 'Neon Mavi', hex: '#3B82F6' },
  { id: '#10B981', name: 'Zümrüt Yeşil', hex: '#10B981' },
  { id: '#F43F5E', name: 'Lazer Kırmızı', hex: '#F43F5E' },
  { id: '#F59E0B', name: 'Güneş Sarısı', hex: '#F59E0B' },
  { id: '#8B5CF6', name: 'Galaksi Mor', hex: '#8B5CF6' },
  { id: '#06B6D4', name: 'Siber Cyan', hex: '#06B6D4' },
  { id: '#EC4899', name: 'Hiper Pembe', hex: '#EC4899' },
  { id: '#F97316', name: 'Volkanik Turuncu', hex: '#F97316' },
  { id: '#EAB308', name: '24K Altın', hex: '#EAB308' },
  { id: '#14B8A6', name: 'Teal Turkuaz', hex: '#14B8A6' },
  { id: '#A855F7', name: 'Elektrik Leylak', hex: '#A855F7' },
  { id: '#84CC16', name: 'Toksik Limon', hex: '#84CC16' },
  { id: '#EF4444', name: 'Kızıl Kor', hex: '#EF4444' },
  { id: '#38BDF8', name: 'Gökyüzü', hex: '#38BDF8' },
  { id: '#FFFFFF', name: 'Kutup Beyazı', hex: '#FFFFFF' },
  { id: '#64748B', name: 'Titanyum Çelik', hex: '#64748B' },
];

export const SECONDARY_COLORS = [
  { id: '#FEF08A', name: 'Açık Sarı', hex: '#FEF08A' },
  { id: '#67E8F9', name: 'Buz Mavisi', hex: '#67E8F9' },
  { id: '#F472B6', name: 'Aura Pembe', hex: '#F472B6' },
  { id: '#A7F3D0', name: 'Nane Yeşili', hex: '#A7F3D0' },
  { id: '#FDE047', name: 'Neon Altın', hex: '#FDE047' },
  { id: '#FFFFFF', name: 'Saf Beyaz', hex: '#FFFFFF' },
  { id: '#FCA5A5', name: 'Açık Kırmızı', hex: '#FCA5A5' },
  { id: '#DDD6FE', name: 'Lavanta', hex: '#DDD6FE' },
  { id: '#BAE6FD', name: 'Kristal Açık', hex: '#BAE6FD' },
  { id: '#BBF7D0', name: 'Bahar Yeşili', hex: '#BBF7D0' },
  { id: '#FED7AA', name: 'Kavun Turuncu', hex: '#FED7AA' },
  { id: '#090D16', name: 'Obsidyen Siyah', hex: '#090D16' },
];

export const TRAIL_EFFECTS: CosmeticOption[] = [
  { id: 'trail-classic', name: 'Klasik Neon İz', desc: 'Pürüzsüz gölgeli akıcı iz' },
  { id: 'trail-rainbow', name: 'Gökkuşağı Şerit', desc: 'Rengarenk spektrum renk geçişleri' },
  { id: 'trail-fire', name: 'Alev Kıvılcımları', desc: 'Arkada kalan sıcak köz ve alevler' },
  { id: 'trail-matrix', name: 'Matriks Veri', desc: 'Kayan yeşil dijital kod noktacıkları' },
  { id: 'trail-stars', name: 'Kozmik Yıldızlar', desc: 'Işıltılı altın ve beyaz yıldız izi' },
  { id: 'trail-plasma', name: 'Elektrik Kıvılcım', desc: 'Mavi ve mor plazma arkları' },
  { id: 'trail-hearts', name: 'Aşk Kalpleri', desc: 'Pembe parlayan uçuşan minik kalpler' },
  { id: 'trail-lightning', name: 'Yıldırım Şimşeği', desc: 'Zig-zag çizen yüksek voltaj kıvılcımları' },
];

export const DEATH_EFFECTS: CosmeticOption[] = [
  { id: 'death-classic', name: 'Kare Kırılma', desc: 'Orijinal kare parçacık patlaması' },
  { id: 'death-nova', name: 'Süpernova Çemberi', desc: 'Genişleyen yüksek enerjili şok dalgası' },
  { id: 'death-firework', name: 'Havai Fişek', desc: 'Rengarenk ışıltılı konfeti patlaması' },
  { id: 'death-pixel', name: 'Piksel Çözülme', desc: 'Retro 8-bit dijital piksel saçılması' },
  { id: 'death-hearts', name: 'Kırık Kalpler', desc: 'Sevimli kırık neon kalp parçacıkları' },
  { id: 'death-blackhole', name: 'Kara Delik', desc: 'İçe çöken karanlık yerçekimi dalgası' },
  { id: 'death-coin-burst', name: 'Altın Püskürmesi', desc: 'Etrafa saçılan parlak şampiyon paraları' },
  { id: 'death-cyber-grid', name: 'Siber Şebeke', desc: 'Dijital matris parçalanma efekti' },
];

export const DEFAULT_COSMETICS: PlayerCosmetics = {
  cubeSkin: 'cube-classic',
  shipSkin: 'ship-classic',
  waveSkin: 'wave-classic',
  primaryColor: '#3B82F6',
  secondaryColor: '#FEF08A',
  trailEffect: 'trail-classic',
  deathEffect: 'death-classic',
};

export function loadSavedCosmetics(): PlayerCosmetics {
  try {
    const raw = localStorage.getItem('gd_cosmetics_v1');
    if (raw) {
      return { ...DEFAULT_COSMETICS, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_COSMETICS;
}

export function saveCosmetics(cosmetics: PlayerCosmetics): void {
  try {
    localStorage.setItem('gd_cosmetics_v1', JSON.stringify(cosmetics));
  } catch {
    // ignore
  }
}

// Canvas Drawing Helper for all Cube Skins
export function drawCubeSkin(
  ctx: CanvasRenderingContext2D,
  skinId: string,
  primaryColor: string,
  secondaryColor: string,
  size: number
) {
  const half = size / 2;

  // Base Cube Body
  ctx.fillStyle = primaryColor;
  ctx.fillRect(-half, -half, size, size);

  // Outer Crisp Stroke
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.strokeRect(-half, -half, size, size);

  // Inner Accent Border
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-half + 3, -half + 3, size - 6, size - 6);

  // Specific Skin Face Features
  switch (skinId) {
    case 'cube-ninja': {
      // Red/Secondary Headband
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-half + 1, -half + 5, size - 2, 7);
      // Ninja eyes
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-half + 6, -half + 15, 6, 4);
      ctx.fillRect(half - 12, -half + 15, 6, 4);
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-half + 8, -half + 16, 2, 2);
      ctx.fillRect(half - 10, -half + 16, 2, 2);
      break;
    }
    case 'cube-cyclops': {
      // Large Center Optic
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Glowing core
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cube-creeper': {
      // Pixelated face
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-half + 5, -half + 6, 6, 6);
      ctx.fillRect(half - 11, -half + 6, 6, 6);
      ctx.fillRect(-half + 9, -half + 12, 10, 8);
      ctx.fillRect(-half + 7, -half + 16, 14, 8);
      break;
    }
    case 'cube-cat': {
      // Cat Ears
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(-half + 2, -half);
      ctx.lineTo(-half + 7, -half - 5);
      ctx.lineTo(-half + 12, -half);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(half - 12, -half);
      ctx.lineTo(half - 7, -half - 5);
      ctx.lineTo(half - 2, -half);
      ctx.fill();

      // Eyes & Whiskers
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-half + 6, -half + 9, 5, 5);
      ctx.fillRect(half - 11, -half + 9, 5, 5);
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-1, 0, 3, 3);
      break;
    }
    case 'cube-skull': {
      ctx.fillStyle = '#090D16';
      // Eye sockets
      ctx.fillRect(-half + 5, -half + 7, 7, 8);
      ctx.fillRect(half - 12, -half + 7, 7, 8);
      // Nose
      ctx.fillRect(-2, 1, 4, 3);
      // Teeth
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-half + 7, half - 7, 3, 5);
      ctx.fillRect(-half + 12, half - 7, 3, 5);
      ctx.fillRect(half - 15, half - 7, 3, 5);
      ctx.fillRect(half - 10, half - 7, 3, 5);
      break;
    }
    case 'cube-fire': {
      // Flame spikes on top
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(-half + 4, -half);
      ctx.lineTo(-half + 8, -half - 6);
      ctx.lineTo(0, -half);
      ctx.lineTo(half - 8, -half - 6);
      ctx.lineTo(half - 4, -half);
      ctx.closePath();
      ctx.fill();

      // Fierce sloped eyes
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.moveTo(-half + 5, -half + 8);
      ctx.lineTo(-half + 12, -half + 12);
      ctx.lineTo(-half + 5, -half + 14);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(half - 5, -half + 8);
      ctx.lineTo(half - 12, -half + 12);
      ctx.lineTo(half - 5, -half + 14);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'cube-target': {
      // Crosshair
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-half + 4, 0);
      ctx.lineTo(half - 4, 0);
      ctx.moveTo(0, -half + 4);
      ctx.lineTo(0, half - 4);
      ctx.stroke();
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cube-crown': {
      // Golden Crown on top
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(-half + 4, -half);
      ctx.lineTo(-half + 4, -half - 7);
      ctx.lineTo(-half + 10, -half - 3);
      ctx.lineTo(0, -half - 8);
      ctx.lineTo(half - 10, -half - 3);
      ctx.lineTo(half - 4, -half - 7);
      ctx.lineTo(half - 4, -half);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Classic friendly face
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-half + 6, -half + 10, 5, 5);
      ctx.fillRect(half - 11, -half + 10, 5, 5);
      ctx.fillRect(-half + 7, half - 7, size - 14, 3);
      break;
    }
    case 'cube-matrix': {
      // Circuit grid
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-half + 4, -half + 10);
      ctx.lineTo(0, -half + 10);
      ctx.lineTo(0, half - 10);
      ctx.lineTo(half - 4, half - 10);
      ctx.stroke();
      // Glowing nodes
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-half + 6, -half + 8, 4, 4);
      ctx.fillRect(half - 10, half - 12, 4, 4);
      break;
    }
    case 'cube-demon': {
      // Spiked horns
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(-half, -half + 4);
      ctx.lineTo(-half - 5, -half - 4);
      ctx.lineTo(-half + 6, -half);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(half, -half + 4);
      ctx.lineTo(half + 5, -half - 4);
      ctx.lineTo(half - 6, -half);
      ctx.closePath();
      ctx.fill();

      // Sharp eyes and grin
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-half + 6, -half + 8, 6, 4);
      ctx.fillRect(half - 12, -half + 8, 6, 4);
      ctx.fillRect(-half + 7, half - 8, size - 14, 4);
      break;
    }
    case 'cube-glitch': {
      // Offset colored block
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-half + 4, -half + 3, size - 8, 4);
      ctx.fillRect(-half + 8, 0, size - 16, 4);
      ctx.fillRect(-half + 2, half - 7, size - 10, 4);
      break;
    }
    case 'cube-companion': {
      // Companion Cube: corner plates & glowing heart in center
      ctx.fillStyle = secondaryColor;
      // 4 corner squares
      ctx.fillRect(-half + 2, -half + 2, 6, 6);
      ctx.fillRect(half - 8, -half + 2, 6, 6);
      ctx.fillRect(-half + 2, half - 8, 6, 6);
      ctx.fillRect(half - 8, half - 8, 6, 6);
      // Center circle
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      // Center glowing heart
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.bezierCurveTo(-4, 0, -5, -4, 0, -4);
      ctx.bezierCurveTo(5, -4, 4, 0, 0, 3);
      ctx.fill();
      break;
    }
    case 'cube-diamond': {
      // Diamond facets
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -half + 4);
      ctx.lineTo(half - 4, 0);
      ctx.lineTo(0, half - 4);
      ctx.lineTo(-half + 4, 0);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cube-samurai': {
      // Kabuto helmet crest
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(-half + 3, -half);
      ctx.lineTo(-half - 3, -half - 8);
      ctx.lineTo(0, -half - 4);
      ctx.lineTo(half + 3, -half - 8);
      ctx.lineTo(half - 3, -half);
      ctx.closePath();
      ctx.fill();
      // Visor
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-half + 4, -half + 8, size - 8, 6);
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-half + 7, -half + 10, size - 14, 2);
      break;
    }
    case 'cube-alien': {
      // 3 Eyes
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.arc(-7, -3, 3.5, 0, Math.PI * 2);
      ctx.arc(0, -6, 3.5, 0, Math.PI * 2);
      ctx.arc(7, -3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(-7, -3, 1.8, 0, Math.PI * 2);
      ctx.arc(0, -6, 1.8, 0, Math.PI * 2);
      ctx.arc(7, -3, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // Alien mouth
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-4, 4, 8, 3);
      break;
    }
    case 'cube-gold': {
      // 24K Luxury Shine
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.strokeRect(-half + 2, -half + 2, size - 4, size - 4);
      // Sparkle diamond center
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(3, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();
      // Diamond eyes
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-half + 6, -half + 7, 5, 5);
      ctx.fillRect(half - 11, -half + 7, 5, 5);
      break;
    }
    case 'cube-ghost': {
      // Ghost glowing eyes
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.arc(-6, -2, 4.5, 0, Math.PI * 2);
      ctx.arc(6, -2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(-6, -2, 2, 0, Math.PI * 2);
      ctx.arc(6, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      // Wavy bottom skirt
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-half + 3, half - 5, size - 6, 2);
      break;
    }
    case 'cube-mecha': {
      // Mecha angled plate
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-half + 4, -half + 8, size - 8, 7);
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(-half + 6, -half + 11);
      ctx.lineTo(half - 6, -half + 11);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-2, -half + 9, 4, 4);
      break;
    }
    case 'cube-vampire': {
      // Bat wings
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(-half, -half + 3);
      ctx.lineTo(-half - 6, -half - 3);
      ctx.lineTo(-half + 2, -half + 8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(half, -half + 3);
      ctx.lineTo(half + 6, -half - 3);
      ctx.lineTo(half - 2, -half + 8);
      ctx.closePath();
      ctx.fill();
      // Red eyes & fangs
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-half + 6, -half + 8, 5, 4);
      ctx.fillRect(half - 11, -half + 8, 5, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-half + 8, half - 7, 2, 4);
      ctx.fillRect(half - 10, half - 7, 2, 4);
      break;
    }
    default: {
      // Classic cube face
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-half + 7, -half + 8, 5, 5);
      ctx.fillRect(half - 12, -half + 8, 5, 5);
      ctx.fillRect(-half + 8, half - 8, size - 16, 3);
      break;
    }
  }
}

// Canvas Drawing Helper for Ship Skins
export function drawShipSkin(
  ctx: CanvasRenderingContext2D,
  skinId: string,
  primaryColor: string,
  secondaryColor: string,
  isHolding: boolean
) {
  ctx.fillStyle = primaryColor;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;

  switch (skinId) {
    case 'ship-stealth': {
      // Angular stealth jet
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-8, -15);
      ctx.lineTo(-16, -10);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-16, 10);
      ctx.lineTo(-8, 15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Canopy
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-2, -5);
      ctx.lineTo(-2, 5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ship-cruiser': {
      // Heavy cruiser
      ctx.fillRect(-14, -10, 24, 20);
      ctx.strokeRect(-14, -10, 24, 20);
      ctx.beginPath();
      ctx.moveTo(10, -10);
      ctx.lineTo(20, 0);
      ctx.lineTo(10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-16, -14, 8, 5);
      ctx.fillRect(-16, 9, 8, 5);
      break;
    }
    case 'ship-shark': {
      // Shark rocket
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-4, -14);
      ctx.lineTo(-8, -6);
      ctx.lineTo(-16, -12);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-16, 12);
      ctx.lineTo(-4, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Shark eye
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(4, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ship-ufo': {
      // Saucer dome
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(0, -3, 6, Math.PI, 0);
      ctx.fill();
      break;
    }
    case 'ship-dragon': {
      // Dragon wing
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-6, -16);
      ctx.lineTo(-16, -8);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-16, 8);
      ctx.lineTo(-6, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-4, 6);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ship-phoenix': {
      // Fiery wings & tail feathers
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(-4, -18);
      ctx.lineTo(-12, -12);
      ctx.lineTo(-8, -4);
      ctx.lineTo(-18, 0);
      ctx.lineTo(-8, 4);
      ctx.lineTo(-12, 12);
      ctx.lineTo(-4, 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(0, -7);
      ctx.lineTo(-4, 0);
      ctx.lineTo(0, 7);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ship-cyberpunk': {
      // Dual nacelle pod
      ctx.fillRect(-16, -14, 26, 7);
      ctx.strokeRect(-16, -14, 26, 7);
      ctx.fillRect(-16, 7, 26, 7);
      ctx.strokeRect(-16, 7, 26, 7);

      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -6);
      ctx.lineTo(-10, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'ship-sub': {
      // Submarine hull
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Periscope
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-4, -14, 4, 6);
      ctx.fillRect(-4, -14, 8, 3);
      // Porthole
      ctx.beginPath();
      ctx.arc(4, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ship-rocket': {
      // Retro Apollo rocket
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-18, -14);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-18, 14);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      // Classic dart
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-14, -13);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  // Thruster jet flame when thrusting
  if (isHolding) {
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(-24, 0);
    ctx.lineTo(-10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.moveTo(-10, -2.5);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-10, 2.5);
    ctx.closePath();
    ctx.fill();
  }
}

// Canvas Drawing Helper for Wave Skins
export function drawWaveSkin(
  ctx: CanvasRenderingContext2D,
  skinId: string,
  primaryColor: string,
  secondaryColor: string
) {
  ctx.fillStyle = primaryColor;
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 2;

  switch (skinId) {
    case 'wave-shuriken': {
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(2, -14);
      ctx.lineTo(-6, 0);
      ctx.lineTo(2, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'wave-trident': {
      // 3-point trident dart
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(8, -5);
      ctx.lineTo(12, -14);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-6, 6);
      ctx.lineTo(12, 14);
      ctx.lineTo(8, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'wave-crystal': {
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(4, -12);
      ctx.lineTo(-14, 0);
      ctx.lineTo(4, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(0, -6);
      ctx.lineTo(-6, 0);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'wave-plasma': {
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(2, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'wave-stealth': {
      ctx.beginPath();
      ctx.moveTo(19, 0);
      ctx.lineTo(-8, -14);
      ctx.lineTo(-14, -6);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 6);
      ctx.lineTo(-8, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'wave-scythe': {
      // Curved reaper blade
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.quadraticCurveTo(0, -18, -14, -10);
      ctx.lineTo(-8, 0);
      ctx.quadraticCurveTo(0, 18, 20, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'wave-laser': {
      // Dual energy laser prongs
      ctx.beginPath();
      ctx.moveTo(18, -5);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-12, 10);
      ctx.lineTo(18, 5);
      ctx.lineTo(4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'wave-needle': {
      // Hypersonic thin needle
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(-14, -6);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'wave-comet': {
      // Cosmic sphere & delta wings
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(6, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      // Classic razor arrow
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-14, -12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
}
