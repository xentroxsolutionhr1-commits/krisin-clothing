/* =========================================================
   KRISIN CLOTHING — sample catalogue data
   In a production build this would come from a database via
   an API (see /docs/architecture.md for the intended schema).
   ========================================================= */

const IMG = (id, w = 1200) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

const PRODUCTS = [
  {
    id: "mc-001",
    name: "Minimal Oversized Tee",
    category: "T-Shirts",
    price: 899,
    compareAt: null,
    colors: [
      { name: "Black", hex: "#161615" },
      { name: "Off-White", hex: "#e9e6e0" },
      { name: "Charcoal", hex: "#3a3835" }
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    outOfStock: ["XS"],
    stock: 42,
    images: [IMG("photo-1521572163474-6864f9cf17ab"), IMG("photo-1596755094514-f87e34085b2c")],
    description: "A heavyweight cotton tee cut with a relaxed, dropped shoulder for an easy silhouette. Garment-washed for a lived-in softness from the first wear.",
    fit: "Oversized fit. Model is 6'0\" wearing size M. Runs true to size with room through the body.",
    material: "100% combed cotton, 220 GSM. Pre-shrunk. Machine wash cold, inside out.",
    isNew: true,
    bestSeller: true
  },
  {
    id: "mc-002",
    name: "Essential Cotton Shirt",
    category: "Shirts",
    price: 1499,
    compareAt: null,
    colors: [
      { name: "White", hex: "#ffffff" },
      { name: "Light Gray", hex: "#c9c6c0" }
    ],
    sizes: ["S", "M", "L", "XL"],
    outOfStock: [],
    stock: 27,
    images: [IMG("photo-1541099649105-f69ad21f3246"), IMG("photo-1594938298603-c8148c4dae35")],
    description: "A clean, structured shirt built for every day, from desk to dinner. Mother-of-pearl buttons and a modern collar keep it sharp without trying too hard.",
    fit: "Regular fit through the chest, tapered waist. True to size.",
    material: "100% cotton poplin. Machine wash cold, tumble dry low.",
    isNew: false,
    bestSeller: true
  },
  {
    id: "mc-003",
    name: "Relaxed Fit Pants",
    category: "Pants",
    price: 1799,
    compareAt: 2199,
    colors: [
      { name: "Charcoal", hex: "#3a3835" },
      { name: "Black", hex: "#161615" }
    ],
    sizes: ["28", "30", "32", "34", "36"],
    outOfStock: ["28"],
    stock: 19,
    images: [IMG("photo-1594633312681-425c7b97ccd1"), IMG("photo-1552902865-b72c031ac5ea")],
    description: "Tapered through the leg with a relaxed rise, these pants move with you. A tonal drawcord and hidden pockets keep the front clean.",
    fit: "Relaxed through the hip and thigh, tapered ankle. Sits at the natural waist.",
    material: "97% cotton, 3% elastane twill. Machine wash cold.",
    isNew: false,
    bestSeller: true
  },
  {
    id: "mc-004",
    name: "Classic Pullover Hoodie",
    category: "Hoodies",
    price: 1999,
    compareAt: null,
    colors: [
      { name: "Black", hex: "#161615" },
      { name: "Off-White", hex: "#e9e6e0" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    outOfStock: [],
    stock: 35,
    images: [IMG("photo-1620799140408-edc6dcb6d633"), IMG("photo-1490114538077-0a7f8cb49891")],
    description: "Our signature hoodie in brushed fleece, heavy enough to hold its shape and soft enough to live in. Ribbed cuffs and hem for a cleaner finish.",
    fit: "Regular fit, slightly dropped shoulder. True to size.",
    material: "80% cotton, 20% polyester fleece, 380 GSM.",
    isNew: true,
    bestSeller: true
  },
  {
    id: "mc-005",
    name: "Structured Overshirt",
    category: "Shirts",
    price: 1899,
    compareAt: null,
    colors: [{ name: "Charcoal", hex: "#3a3835" }],
    sizes: ["S", "M", "L", "XL"],
    outOfStock: [],
    stock: 14,
    images: [IMG("photo-1523381210434-271e8be1f52b"), IMG("photo-1556905055-8f358a7a47b2")],
    description: "A midweight overshirt that layers cleanly over a tee or under a coat. Corozo buttons and a boxy body for an easy, considered layer.",
    fit: "Boxy fit. Size down for a closer layer.",
    material: "100% brushed cotton twill.",
    isNew: true,
    bestSeller: false
  },
  {
    id: "mc-006",
    name: "Tapered Chino",
    category: "Pants",
    price: 1699,
    compareAt: null,
    colors: [
      { name: "Off-White", hex: "#e9e6e0" },
      { name: "Charcoal", hex: "#3a3835" }
    ],
    sizes: ["28", "30", "32", "34", "36"],
    outOfStock: [],
    stock: 22,
    images: [IMG("photo-1473966968600-fa801b869a1a"), IMG("photo-1517438476312-10d79c077509")],
    description: "A slim, tapered chino built in a stretch twill that holds a crease without restricting movement.",
    fit: "Slim through the thigh, tapered ankle.",
    material: "98% cotton, 2% elastane.",
    isNew: false,
    bestSeller: false
  },
  {
    id: "mc-007",
    name: "Round Acetate Sunglasses",
    category: "Glasses",
    price: 1299,
    compareAt: null,
    colors: [{ name: "Black", hex: "#161615" }, { name: "Tortoise", hex: "#6b4a2f" }],
    sizes: ["One Size"],
    outOfStock: [],
    stock: 30,
    images: [IMG("photo-1591047139829-d91aecb6caea"), IMG("photo-1483985988355-763728e1935b")],
    description: "Hand-finished acetate frames with UV400 lenses. A rounded silhouette that keeps the everyday edit sharp.",
    fit: "One size. 145mm temple length.",
    material: "Italian acetate frame, polarized UV400 lenses.",
    isNew: true,
    bestSeller: false
  },
  {
    id: "mc-008",
    name: "Wire Frame Glasses",
    category: "Glasses",
    price: 1099,
    compareAt: null,
    colors: [{ name: "Silver", hex: "#c9c6c0" }, { name: "Black", hex: "#161615" }],
    sizes: ["One Size"],
    outOfStock: [],
    stock: 18,
    images: [IMG("photo-1508296695146-257a814070b4"), IMG("photo-1508296695146-257a814070b4", 900)],
    description: "A featherlight wire frame with a slim keyhole bridge, quietly precise and built to disappear on the face.",
    fit: "One size. 140mm temple length.",
    material: "Stainless steel frame, polycarbonate lenses.",
    isNew: false,
    bestSeller: false
  },
  {
    id: "mc-009",
    name: "Leather Card Holder",
    category: "Accessories",
    price: 799,
    compareAt: null,
    colors: [{ name: "Black", hex: "#161615" }, { name: "Charcoal", hex: "#3a3835" }],
    sizes: ["One Size"],
    outOfStock: [],
    stock: 50,
    images: [IMG("photo-1553062407-98eeb64c6a62"), IMG("photo-1627123424574-724758594e93")],
    description: "Full-grain leather, cut and stitched to hold four cards and folded notes without bulk. Ages into its own patina.",
    fit: "One size, 9.5 x 7cm.",
    material: "Full-grain vegetable-tanned leather.",
    isNew: false,
    bestSeller: false
  },
  {
    id: "mc-010",
    name: "Ribbed Knit Beanie",
    category: "Accessories",
    price: 599,
    compareAt: null,
    colors: [{ name: "Black", hex: "#161615" }, { name: "Off-White", hex: "#e9e6e0" }],
    sizes: ["One Size"],
    outOfStock: [],
    stock: 40,
    images: [IMG("photo-1576871337622-98d48d1cf531"), IMG("photo-1576871337622-98d48d1cf531", 900)],
    description: "A close-ribbed beanie in a merino-cotton blend, cut with a shallow fold for a cleaner line than the usual slouch.",
    fit: "One size, fits most.",
    material: "70% cotton, 30% merino wool.",
    isNew: false,
    bestSeller: false
  },
  {
    id: "mc-011",
    name: "Boxy Crewneck Sweatshirt",
    category: "Hoodies",
    price: 1699,
    compareAt: null,
    colors: [{ name: "Light Gray", hex: "#c9c6c0" }, { name: "Black", hex: "#161615" }],
    sizes: ["S", "M", "L", "XL"],
    outOfStock: [],
    stock: 24,
    images: [IMG("photo-1620401537278-9c3ac0a09b02"), IMG("photo-1516257984-b1b4d707412e")],
    description: "A crewneck built boxy and cropped just slightly at the hem, in a fleece heavy enough to wear as an outer layer.",
    fit: "Boxy fit, dropped shoulder.",
    material: "85% cotton, 15% polyester fleece.",
    isNew: true,
    bestSeller: false
  },
  {
    id: "mc-012",
    name: "Slim Fit Poplin Shirt",
    category: "Shirts",
    price: 1399,
    compareAt: null,
    colors: [{ name: "White", hex: "#ffffff" }],
    sizes: ["S", "M", "L", "XL"],
    outOfStock: ["XL"],
    stock: 12,
    images: [IMG("photo-1602810318383-e386cc2a3ccf"), IMG("photo-1489987707025-afc232f7ea0f")],
    description: "A slim-cut poplin shirt with a clean spread collar, the one that goes under everything and stands alone just as well.",
    fit: "Slim fit. Size up for a more relaxed drape.",
    material: "100% cotton poplin.",
    isNew: false,
    bestSeller: false
  }
];

const CATEGORIES = ["T-Shirts", "Shirts", "Pants", "Hoodies", "Glasses", "Accessories"];

function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function formatPrice(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}
