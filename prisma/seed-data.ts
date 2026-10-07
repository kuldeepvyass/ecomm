/**
 * Demo catalogue for previewing the design. Every brand, product, review and rating
 * created from this file is flagged isDemo = true and can be removed in one click
 * from Admin → Settings → "Delete all sample data".
 *
 * Photos: free-to-use images from Unsplash (https://unsplash.com/license), served from
 * images.unsplash.com. Extra gallery "angles" are zoomed crops of the same photograph.
 */

const P: Record<number, string> = {
  1: "1618215650148-e8e61eae521c", 2: "1600003014608-c2ccc1570a65", 4: "1670177257750-9b47927f68eb",
  6: "1620625515032-6ed0c1790c75", 7: "1524805444758-089113d48a6d", 8: "1618215649872-6e3143a716ec",
  10: "1634140704051-58a787556cd1", 11: "1587925358603-c2eea5305bbc", 12: "1604242692760-2f7b0c26856d",
  13: "1524592094714-0f0654e20314", 14: "1506193095-80bc749473f2", 15: "1590736969955-71cc94801759",
  16: "1549972574-8e3e1ed6a347", 17: "1751437774882-deeea4352018", 18: "1751437761644-460ae92e34c9",
  19: "1653651460770-73513a4b25a5", 20: "1451290337906-ac938fc89bce", 22: "1584208123923-cc027813cbcb",
  23: "1580226223521-5412ec88237a", 24: "1525740664269-1bb17f251737", 25: "1451477334999-a9321157a431",
  26: "1580837428500-74aa7eefc672", 27: "1657159810148-f6a1f3d74f7e", 28: "1582121757128-252a7f88f7a2",
  29: "1633599925393-a4af0a650546", 32: "1533139502658-0198f920d8e8", 34: "1629581678313-36cf745a9af9",
  35: "1557531365-e8b22d93dbd0", 36: "1703505841379-2f863b201212", 37: "1573261821759-fdd1b36d9ca5",
  38: "1582150264904-e0bea5ef0ad1", 39: "1539874754764-5a96559165b0", 40: "1507679622673-989605832e3d",
  41: "1602752975366-5520991f958d", 42: "1633451238042-85d93d267866", 43: "1646724684583-764bb3f47c1f",
  44: "1605143185650-77944b152643", 46: "1646724810360-abfa1bb76d6d", 47: "1694023769753-ab40f6aeb52a",
  48: "1764429601437-85ad5745f0b7", 49: "1690343430066-d4634276895d", 50: "1712890933285-7a4371686947",
  51: "1708247804802-6851ddd47234", 53: "1541778480-fc1752bbc2a9", 54: "1694442139405-28866401a322",
  55: "1613704193420-a53cab02d194", 56: "1628608569034-e214532ddfde", 57: "1751437819603-aaf4dfa8420a",
  58: "1704783512705-a943b9ebe66f", 59: "1618215650201-8d552591218d", 60: "1662333084914-3eea84762671",
  61: "1618215649514-c73c18549d63", 64: "1542816340-4d3de5047cfd", 66: "1610897534349-7759782118b9",
  67: "1620421895918-b4e8c86648fb", 68: "1646889416154-973ea0e5e36f", 69: "1603850179998-3a57f293b2c5",
  70: "1607850478432-a80d4ff5aa41",
};

/** n = photo index; z = zoomed "detail" crop of the same photograph. */
type Img = { n: number; z?: boolean; fx?: number };
const img = (n: number, z = false, fx?: number): Img => ({ n, z, fx });

export function imageUrl({ n, z, fx }: Img): string {
  const id = P[n];
  if (!id) throw new Error(`Unknown photo index ${n}`);
  const crop = fx !== undefined ? `crop=focalpoint&fp-x=${fx}&fp-y=0.5&fp-z=${z ? 1.5 : 1}` : z ? "crop=focalpoint&fp-x=0.5&fp-y=0.5&fp-z=1.9" : "crop=entropy";
  return `https://images.unsplash.com/photo-${id}?fit=crop&ar=4:5&${crop}`;
}

export const HERO_IMAGE = `https://images.unsplash.com/photo-${P[44]}?fit=crop&ar=16:9&crop=entropy`;
export const HERO_IMAGE_MOBILE = `https://images.unsplash.com/photo-${P[44]}?fit=crop&ar=4:5&crop=entropy`;
/** Free-to-use Pexels clip (pexels.com/video/10728498): macro of an open-worked dial, no brand marks. */
export const HERO_VIDEO = "https://videos.pexels.com/video-files/10728498/10728498-hd_1280_720_30fps.mp4";
export const STORY_IMAGE = `https://images.unsplash.com/photo-${P[48]}?fit=crop&ar=4:5&crop=entropy`;
export const COLLECTION_IMAGES: Record<string, string> = {
  dress: imageUrl(img(37)),
  dive: imageUrl(img(68)),
  chronograph: imageUrl(img(28)),
  "limited-edition": imageUrl(img(10)),
};

export const BRANDS = [
  {
    name: "Maison Verrault", slug: "maison-verrault", tagline: "Haute horlogerie since 1891",
    story: "Founded in a Vallée de Joux farmhouse, Maison Verrault still finishes every bridge by hand. Its signature is restraint: thin cases, perfect proportions and movements decorated where only the owner will see.",
  },
  {
    name: "Aurèle & Fils", slug: "aurele-et-fils", tagline: "Three generations of precision",
    story: "A family atelier in Le Locle known for robust chronographs and tool watches that are as comfortable at the bottom of the sea as at the opera.",
  },
  {
    name: "Valcourt", slug: "valcourt", tagline: "Genève · Joaillerie & horlogerie",
    story: "Valcourt marries the jeweller's eye with the watchmaker's discipline — gem-set bezels, enamel dials and colours drawn from the Riviera.",
  },
  {
    name: "Halvard", slug: "halvard", tagline: "Nordic design, Swiss heart",
    story: "Halvard designs in Copenhagen and assembles in Biel. Clean dials, honest materials and prices that make a first fine watch possible.",
  },
  {
    name: "Lucerne Atelier", slug: "lucerne-atelier", tagline: "Instruments for the curious",
    story: "From pilot chronographs to open-heart dress watches, Lucerne Atelier builds mechanical instruments with a sense of adventure.",
  },
] as const;

export const COLLECTIONS = [
  { name: "Dress", slug: "dress", sortOrder: 1, description: "Slim cases and quiet dials, made for cuffs and candlelight." },
  { name: "Dive", slug: "dive", sortOrder: 2, description: "Unidirectional bezels, lume and real water resistance." },
  { name: "Chronograph", slug: "chronograph", sortOrder: 3, description: "Pushers, sub-dials and the romance of measured time." },
  { name: "Limited Edition", slug: "limited-edition", sortOrder: 4, description: "Numbered pieces in small series. Once they're gone, they're gone." },
] as const;

type Spec = {
  brand: (typeof BRANDS)[number]["slug"];
  modelName: string;
  ref: string;
  gender: "MEN" | "WOMEN";
  mrp: number;
  cost: number;
  stock: number;
  collections: (typeof COLLECTIONS)[number]["slug"][];
  featured?: boolean;
  override?: number;
  exclude?: boolean;
  caseMaterial: string;
  dia: number;
  thick: number;
  lug: number;
  dial: string;
  strap: string;
  strapColour: string;
  movement: "AUTOMATIC" | "QUARTZ" | "MANUAL";
  calibre: string;
  power: number | null;
  wr: number;
  crystal: string;
  weight: number;
  warranty: number;
  description: string;
  images: Img[];
  ext: { rating: number; count: number };
  reviews: number;
  daysAgo: number;
};

export const PRODUCTS: Spec[] = [
  // ───────────── Men ─────────────
  {
    brand: "maison-verrault", modelName: "Équinoxe Chronograph", ref: "MV-4120.01", gender: "MEN", mrp: 68500, cost: 46000, stock: 6,
    collections: ["chronograph"], featured: true, caseMaterial: "Stainless steel", dia: 41, thick: 13.2, lug: 20, dial: "Silver",
    strap: "Alligator leather", strapColour: "Black", movement: "AUTOMATIC", calibre: "MV 4120 column-wheel", power: 60, wr: 100,
    crystal: "Sapphire, anti-reflective", weight: 98, warranty: 60,
    description: "A column-wheel chronograph with a silvered opaline dial, applied indices and a tachymeter flange. The Équinoxe balances sporting function with the proportions of a dress watch.",
    images: [img(28), img(28, true), img(58), img(42), img(41)], ext: { rating: 4.7, count: 312 }, reviews: 14, daysAgo: 3,
  },
  {
    brand: "aurele-et-fils", modelName: "Abysse 300 Diver", ref: "AF-300.N", gender: "MEN", mrp: 54900, cost: 36000, stock: 9,
    collections: ["dive"], featured: true, caseMaterial: "Stainless steel", dia: 42, thick: 13.8, lug: 22, dial: "Black",
    strap: "Rubber", strapColour: "Black", movement: "AUTOMATIC", calibre: "AF 300", power: 70, wr: 300,
    crystal: "Domed sapphire", weight: 152, warranty: 36,
    description: "ISO-rated to 300 metres with a ceramic unidirectional bezel, helium escape valve and generous Super-LumiNova. Built for the reef, refined for the boardroom.",
    images: [img(68), img(68, true), img(69), img(67)], ext: { rating: 4.6, count: 1240 }, reviews: 18, daysAgo: 10,
  },
  {
    brand: "valcourt", modelName: "Régate GMT Bleu", ref: "VC-GMT.B", gender: "MEN", mrp: 89000, cost: 60000, stock: 3,
    collections: ["dive"], caseMaterial: "Steel with gold-tone bezel", dia: 40, thick: 12.4, lug: 20, dial: "Blue",
    strap: "Steel bracelet", strapColour: "Two-tone", movement: "AUTOMATIC", calibre: "VC 2893 GMT", power: 42, wr: 200,
    crystal: "Sapphire", weight: 165, warranty: 60,
    description: "A two-time-zone sailor's watch with a sunburst blue dial and a gold-tone accented bracelet. The 24-hour hand tracks home while you chase the horizon.",
    images: [img(54), img(54, true), img(56), img(46)], ext: { rating: 4.8, count: 86 }, reviews: 9, daysAgo: 25,
  },
  {
    brand: "maison-verrault", modelName: "Squelette Automatique", ref: "MV-SQ1891.LE", gender: "MEN", mrp: 99000, cost: 68000, stock: 1,
    collections: ["limited-edition", "dress"], featured: true, exclude: true, caseMaterial: "Rose gold PVD steel", dia: 42, thick: 11.5, lug: 21, dial: "Skeleton",
    strap: "Alligator leather", strapColour: "Brown", movement: "AUTOMATIC", calibre: "MV 1891 skeleton automatic", power: 42, wr: 30,
    crystal: "Sapphire, both sides", weight: 88, warranty: 60,
    description: "Limited to 250 pieces. A fully skeletonised automatic movement framed by a rose-gold-tone case, every bridge open to view. Delivered with a numbered certificate.",
    images: [img(10), img(10, true), img(8), img(59), img(44)], ext: { rating: 4.9, count: 21 }, reviews: 6, daysAgo: 2,
  },
  {
    brand: "lucerne-atelier", modelName: "Aviateur Pilot Chronograph", ref: "LA-AV44", gender: "MEN", mrp: 42500, cost: 28000, stock: 12,
    collections: ["chronograph"], override: 10, caseMaterial: "Stainless steel", dia: 44, thick: 14.6, lug: 22, dial: "Black",
    strap: "Steel bracelet", strapColour: "Silver", movement: "AUTOMATIC", calibre: "LA 7750", power: 48, wr: 100,
    crystal: "Sapphire", weight: 178, warranty: 24,
    description: "A slide-rule bezel, oversized crown and razor-legible black dial — the Aviateur is a cockpit instrument for the wrist.",
    images: [img(36), img(36, true), img(34), img(47)], ext: { rating: 4.4, count: 540 }, reviews: 16, daysAgo: 40,
  },
  {
    brand: "halvard", modelName: "Field 38 Manual Wind", ref: "HV-F38", gender: "MEN", mrp: 18900, cost: 11500, stock: 15,
    collections: ["dress"], caseMaterial: "Brushed stainless steel", dia: 38, thick: 10.2, lug: 19, dial: "White",
    strap: "Calf leather", strapColour: "Black", movement: "MANUAL", calibre: "HV 6498", power: 46, wr: 50,
    crystal: "Box sapphire", weight: 62, warranty: 24,
    description: "The daily ritual of winding, on a 38mm case that suits every wrist. Railway minute track, blued hands and an exhibition caseback.",
    images: [img(49), img(49, true), img(51), img(43)], ext: { rating: 4.5, count: 2140 }, reviews: 20, daysAgo: 60,
  },
  {
    brand: "aurele-et-fils", modelName: "Soleil d'Or Chronograph", ref: "AF-SO.18Y", gender: "MEN", mrp: 79000, cost: 53000, stock: 2,
    collections: ["chronograph", "limited-edition"], caseMaterial: "Gold PVD steel", dia: 40, thick: 12.8, lug: 20, dial: "Black",
    strap: "Steel bracelet", strapColour: "Gold", movement: "AUTOMATIC", calibre: "AF 4130", power: 72, wr: 100,
    crystal: "Sapphire", weight: 210, warranty: 60,
    description: "A gold-tone chronograph with contrasting black registers, limited to 500 pieces. Warm, weighty and unapologetically celebratory.",
    images: [img(4), img(4, true), img(55), img(11)], ext: { rating: 4.8, count: 64 }, reviews: 8, daysAgo: 15,
  },
  {
    brand: "valcourt", modelName: "Nocturne Dress 40", ref: "VC-N40", gender: "MEN", mrp: 29900, cost: 19500, stock: 7,
    collections: ["dress"], caseMaterial: "Gold PVD steel", dia: 40, thick: 8.9, lug: 20, dial: "Black",
    strap: "Steel bracelet", strapColour: "Gold", movement: "AUTOMATIC", calibre: "VC 2824", power: 38, wr: 50,
    crystal: "Sapphire", weight: 94, warranty: 24,
    description: "Just 8.9mm thin, the Nocturne slides beneath a French cuff. A lacquered black dial meets a slim gold-tone case for evenings that matter.",
    images: [img(37), img(37, true), img(40), img(53)], ext: { rating: 4.2, count: 410 }, reviews: 11, daysAgo: 80,
  },
  {
    brand: "halvard", modelName: "Tidewater Automatic", ref: "HV-TW40.BL", gender: "MEN", mrp: 14990, cost: 9000, stock: 0,
    collections: ["dress"], caseMaterial: "Stainless steel", dia: 40, thick: 11, lug: 20, dial: "Blue",
    strap: "Steel mesh", strapColour: "Silver", movement: "AUTOMATIC", calibre: "HV NH35", power: 41, wr: 100,
    crystal: "Sapphire", weight: 105, warranty: 24,
    description: "A sunburst blue dial with a date window and a Milanese mesh strap — the everyday automatic, from sea spray to supper.",
    images: [img(38), img(38, true), img(32), img(50)], ext: { rating: 4.3, count: 980 }, reviews: 12, daysAgo: 120,
  },
  {
    brand: "lucerne-atelier", modelName: "Cœur Ouvert Heritage", ref: "LA-CO41", gender: "MEN", mrp: 24500, cost: 15500, stock: 4,
    collections: ["dress"], caseMaterial: "Stainless steel", dia: 41, thick: 12, lug: 20, dial: "Cream",
    strap: "Alligator leather", strapColour: "Tan", movement: "AUTOMATIC", calibre: "LA 82S7 open-heart", power: 40, wr: 50,
    crystal: "Sapphire", weight: 80, warranty: 24,
    description: "An open-heart aperture at nine o'clock reveals the beating balance wheel. Breguet numerals and a power-reserve indicator complete the heritage look.",
    images: [img(7), img(7, true), img(1), img(2), img(48)], ext: { rating: 4.0, count: 157 }, reviews: 10, daysAgo: 200,
  },

  // ───────────── Women ─────────────
  {
    brand: "maison-verrault", modelName: "Pétale Crystal Chronograph", ref: "MV-P36.D", gender: "WOMEN", mrp: 64000, cost: 42000, stock: 5,
    collections: ["chronograph"], featured: true, caseMaterial: "Stainless steel, crystal-set bezel", dia: 36, thick: 11, lug: 18, dial: "Mother-of-pearl",
    strap: "Steel bracelet", strapColour: "Silver", movement: "QUARTZ", calibre: "MV Q36 chronograph", power: null, wr: 50,
    crystal: "Sapphire", weight: 92, warranty: 36,
    description: "Sixty brilliant-cut crystals frame a mother-of-pearl chronograph dial. Precise quartz, polished bracelet, unmistakable sparkle.",
    images: [img(16), img(16, true), img(25)], ext: { rating: 4.7, count: 228 }, reviews: 13, daysAgo: 5,
  },
  {
    brand: "aurele-et-fils", modelName: "Rosée 32", ref: "AF-R32.RG", gender: "WOMEN", mrp: 38500, cost: 25000, stock: 8,
    collections: ["dress"], featured: true, caseMaterial: "Rose gold PVD steel", dia: 32, thick: 8.5, lug: 16, dial: "Chocolate",
    strap: "Steel bracelet", strapColour: "Rose gold", movement: "AUTOMATIC", calibre: "AF 2671", power: 38, wr: 50,
    crystal: "Sapphire", weight: 70, warranty: 36,
    description: "A petite automatic with a chocolate sunray dial and a crystal-set bezel, on a fluid rose-gold bracelet.",
    images: [img(17), img(17, true), img(18), img(18, true)], ext: { rating: 4.6, count: 342 }, reviews: 15, daysAgo: 8,
  },
  {
    brand: "valcourt", modelName: "Émeraude Joaillerie", ref: "VC-EM34.LE", gender: "WOMEN", mrp: 96000, cost: 65000, stock: 1,
    collections: ["limited-edition", "dress"], caseMaterial: "Gold PVD steel, crystal-set", dia: 34, thick: 9.5, lug: 17, dial: "Emerald green",
    strap: "Steel bracelet", strapColour: "Gold", movement: "AUTOMATIC", calibre: "VC 3000", power: 50, wr: 30,
    crystal: "Sapphire", weight: 118, warranty: 60,
    description: "Limited to 300 pieces. A guilloché emerald-green dial ringed by a crystal-set gold-tone bezel — jewellery that keeps perfect time.",
    images: [img(57), img(57, true), img(19)], ext: { rating: 4.9, count: 12 }, reviews: 5, daysAgo: 1,
  },
  {
    brand: "halvard", modelName: "Linnea 34", ref: "HV-L34.W", gender: "WOMEN", mrp: 12500, cost: 7200, stock: 20,
    collections: ["dress"], caseMaterial: "Rose gold PVD steel", dia: 34, thick: 7.2, lug: 16, dial: "White",
    strap: "Suede", strapColour: "Taupe", movement: "QUARTZ", calibre: "Ronda 763", power: null, wr: 30,
    crystal: "Sapphire", weight: 38, warranty: 24,
    description: "Scandinavian minimalism at its gentlest: a white dial, slender hands and a soft suede strap that only gets better with wear.",
    images: [img(13), img(13, true), img(14)], ext: { rating: 4.4, count: 1875 }, reviews: 19, daysAgo: 30,
  },
  {
    brand: "lucerne-atelier", modelName: "Soirée Mesh", ref: "LA-SM30.G", gender: "WOMEN", mrp: 16900, cost: 10200, stock: 2,
    collections: ["dress"], caseMaterial: "Gold PVD steel", dia: 30, thick: 6.8, lug: 14, dial: "White guilloché",
    strap: "Steel mesh", strapColour: "Gold", movement: "QUARTZ", calibre: "Ronda 762", power: null, wr: 30,
    crystal: "Sapphire", weight: 45, warranty: 24,
    description: "A wave-guilloché dial with crystal indices on a fluid gold mesh strap — the cocktail watch, reimagined.",
    images: [img(20), img(20, true), img(15)], ext: { rating: 4.1, count: 260 }, reviews: 9, daysAgo: 45,
  },
  {
    brand: "maison-verrault", modelName: "Aube Rose", ref: "MV-AR36", gender: "WOMEN", mrp: 22000, cost: 13500, stock: 6,
    collections: ["dress"], override: 12, caseMaterial: "Blush-tone steel", dia: 36, thick: 8.8, lug: 18, dial: "Blush",
    strap: "Steel bracelet", strapColour: "Blush", movement: "QUARTZ", calibre: "ETA F06", power: null, wr: 50,
    crystal: "Sapphire", weight: 84, warranty: 24,
    description: "Blush on blush: a monochrome bracelet watch with a brushed dial and polished bevels that catch the morning light.",
    images: [img(24), img(24, true), img(26)], ext: { rating: 3.9, count: 95 }, reviews: 7, daysAgo: 90,
  },
  {
    brand: "valcourt", modelName: "Céleste 34", ref: "VC-C34.BL", gender: "WOMEN", mrp: 34900, cost: 22500, stock: 4,
    collections: ["dress"], caseMaterial: "Rose gold PVD steel", dia: 34, thick: 9, lug: 17, dial: "Midnight blue",
    strap: "Steel bracelet", strapColour: "Rose gold", movement: "AUTOMATIC", calibre: "VC 2671", power: 38, wr: 50,
    crystal: "Sapphire", weight: 76, warranty: 36,
    description: "A midnight-blue dial with rose-gold accents — the colours of the sky at dusk, translated to the wrist.",
    images: [img(22), img(22, true), img(12)], ext: { rating: 4.5, count: 150 }, reviews: 10, daysAgo: 20,
  },
  {
    brand: "halvard", modelName: "Blanche 36", ref: "HV-B36.WL", gender: "WOMEN", mrp: 9999, cost: 5800, stock: 25,
    collections: ["dress"], caseMaterial: "Gold PVD steel", dia: 36, thick: 6.5, lug: 18, dial: "Ivory",
    strap: "Calf leather", strapColour: "White", movement: "QUARTZ", calibre: "Miyota 2035", power: null, wr: 30,
    crystal: "Mineral glass", weight: 34, warranty: 24,
    description: "An ivory dial, a sliver of gold and a white leather strap — effortless, every day.",
    images: [img(23, false, 0.6), img(23, true, 0.58), img(29)], ext: { rating: 3.8, count: 640 }, reviews: 12, daysAgo: 150,
  },
  {
    brand: "aurele-et-fils", modelName: "Améthyste Automatique", ref: "AF-AM34", gender: "WOMEN", mrp: 27500, cost: 17500, stock: 3,
    collections: ["dress"], caseMaterial: "Gold PVD steel", dia: 34, thick: 10, lug: 18, dial: "Purple",
    strap: "Steel bracelet", strapColour: "Gold", movement: "AUTOMATIC", calibre: "AF 2824", power: 38, wr: 100,
    crystal: "Sapphire", weight: 88, warranty: 36,
    description: "A deep amethyst dial with a lacquered sheen and a small-seconds sub-dial, set in a warm gold-tone case.",
    images: [img(60), img(60, true), img(61)], ext: { rating: 4.2, count: 73 }, reviews: 6, daysAgo: 70,
  },
  {
    brand: "lucerne-atelier", modelName: "Jardin Tank", ref: "LA-JT25.GR", gender: "WOMEN", mrp: 11500, cost: 6900, stock: 10,
    collections: ["dress"], caseMaterial: "Gold PVD steel", dia: 25, thick: 6.5, lug: 14, dial: "Malachite green",
    strap: "Calf leather", strapColour: "Black", movement: "QUARTZ", calibre: "Ronda 1069", power: null, wr: 30,
    crystal: "Sapphire", weight: 30, warranty: 24,
    description: "A rectangular tank case with a malachite-green dial and Roman numerals, on a slim black leather strap.",
    images: [img(27), img(27, true), img(15, true)], ext: { rating: 4.3, count: 410 }, reviews: 8, daysAgo: 12,
  },
];

// ───────────── Sample reviews (demo only) ─────────────
export const REVIEWER_NAMES = [
  "Arjun M.", "Priya S.", "Rohan K.", "Ananya R.", "Vikram T.", "Meera I.", "Karan D.", "Sneha P.", "Aditya V.",
  "Kavya N.", "Rahul B.", "Ishita G.", "Siddharth J.", "Tara C.", "Nikhil A.", "Divya L.", "Aman H.", "Pooja F.",
  "Varun E.", "Riya O.", "Harsh Q.", "Neha W.", "Kabir Y.", "Aisha Z.",
];

export const REVIEW_TEMPLATES: Record<number, { title: string; body: string }[]> = {
  5: [
    { title: "Exceeded every expectation", body: "The finishing is superb — the dial looks even better in person than in the photos. Packaging and paperwork were immaculate and delivery was quick and fully insured." },
    { title: "My grail, finally", body: "I had been saving for this for two years. Sizing is perfect on my wrist and the movement keeps excellent time. The concierge team helped me pick the right strap." },
    { title: "Stunning in daylight", body: "The way the dial plays with light is hard to capture on camera. Bracelet adjustment was done before shipping, which I really appreciated." },
    { title: "Perfect anniversary gift", body: "Bought this for my wife and she hasn't taken it off. The presentation box made it feel very special." },
  ],
  4: [
    { title: "Beautiful, minor quibble", body: "Gorgeous watch and wears comfortably all day. Only wish the clasp had micro-adjustment, but that's a small thing." },
    { title: "Great value for the quality", body: "Very happy overall. The lume could be a touch brighter but the build quality is excellent for the price." },
    { title: "Elegant and versatile", body: "Works with a suit and with jeans. Took a day to get used to the weight but now I love it." },
  ],
  3: [
    { title: "Good, but not for me", body: "Well made, but the case was a little larger on my wrist than I expected. Use the size guide carefully." },
    { title: "Decent, delivery was slow", body: "The watch itself is lovely. Delivery to my PIN code took a couple of days longer than estimated." },
  ],
  2: [
    { title: "Expected more", body: "The strap felt stiff at first and the dial colour is darker than the product photos. Customer service was helpful though." },
  ],
  1: [
    { title: "Had to return it", body: "The bracelet didn't suit my small wrist even after adjustment. The return process was smooth and the refund arrived quickly." },
  ],
};

/** Wrist / lifestyle shots used as customer photos on some demo reviews. */
export const REVIEW_PHOTOS = [img(41), img(56), img(61), img(19), img(1)].map((i) =>
  imageUrl(i).replace("ar=4:5", "ar=1:1"),
);
