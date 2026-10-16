// Carta real de Street Burger, transcripta de las fotos del menú (docs/carta-original/).
// Los precios están tal cual figuran en la carta. Para cambiar algo después: panel → Menú.
const COCA = "/img/bebida-coca-cola.webp";
const burger = (nombre, precio, ingredientes) => ({ nombre, precio, descripcion: `${ingredientes}. Incluye papas fritas.` });

module.exports = [
  { icono: "🍔", nombre: "Hamburguesas", imagen: "/img/hamburguesa.webp", productos: [
    burger("La Clásica", 7000, "Pan de hamburguesa, 1 medallón de carne, queso, lechuga, tomate, mayonesa, mostaza y ketchup"),
    burger("Texana", 8000, "Pan de hamburguesa, 1 medallón de carne, queso cheddar, bacon crujiente, cebolla caramelizada y salsa BBQ"),
    burger("Pizza Burger", 8500, "Pan de hamburguesa, 1 medallón de carne, jamón cocido, queso mozzarella, aceitunas verdes, huevo y salsa de tomate"),
    burger("Green Edition", 8500, "Pan de hamburguesa, 1 medallón de carne, queso cheddar, cebolla caramelizada, salsa barbacoa y salsa picante de la casa"),
    burger("Smash", 8500, "Pan de hamburguesa, doble medallón de carne, doble queso cheddar, cebolla caramelizada y salsa de la casa"),
    burger("Crocante", 7500, "Pan de hamburguesa, 1 medallón de carne, queso cheddar, cebolla frita, papas pay y salsa de la casa"),
    burger("Sweet Burger", 8500, "Pan de hamburguesa, 1 medallón de carne, queso mozzarella, ananá grillado, lechuga, tomate y salsa barbacoa"),
    burger("La Morita", 8500, "Pan de remolacha, 1 medallón de carne, queso cheddar, cebolla caramelizada, tomates, rúcula y mayonesa chipotle"),
    burger("La Criollita", 8500, "Pan de hamburguesa, 1 medallón de carne, queso Tybo, mayonesa casera, salsa criolla y huevo frito"),
    burger("La Bestia Street", 14000, "Pan de hamburguesa, triple medallón de carne, triple queso cheddar, triple bacon, huevo frito y salsa de la casa"),
  ] },
  { icono: "🌭", nombre: "Panchos Gourmet", imagen: "/img/pancho.webp", productos: [
    { nombre: "Pancho clásico", precio: 4500, descripcion: "Pan de pancho, 2 salchichas, papas pay, mayonesa, mostaza y ketchup." },
    { nombre: "Pancho texano", precio: 5500, descripcion: "Pan de pancho, 2 salchichas, queso cheddar, cebolla caramelizada, bacon y salsa barbacoa." },
    { nombre: "Pancho pizza", precio: 6000, descripcion: "Pan de pancho, 2 salchichas, jamón cocido, queso mozzarella, aceitunas verdes, huevo rallado, orégano y salsa de tomate." },
    { nombre: "Pancho explosivo", precio: 7500, descripcion: "Pan de pancho, 2 salchichas, bacon crocante, cebolla caramelizada, huevo frito, papas pay, queso cheddar y salsa especial de la casa." },
  ] },
  { icono: "🍕", nombre: "Pizzas Artesanales", imagen: "/img/pizza.webp", productos: [
    { nombre: "Pizza casera", precio: 10000, descripcion: "Salsa de tomate, mozzarella y orégano." },
    { nombre: "Pizza napolitana", precio: 12000, descripcion: "Salsa de tomate, mozzarella, tomate fresco y orégano." },
    { nombre: "Pizza fugazzeta", precio: 12000, descripcion: "Mozzarella, cebolla y orégano." },
    { nombre: "Pizza calabresa", precio: 12000, descripcion: "Salsa de tomate, mozzarella, calabresa, aceitunas y orégano." },
    { nombre: "Pizza rúcula", precio: 14000, descripcion: "Mozzarella, jamón crudo, tomates cherry, rúcula, queso parmesano y orégano." },
    { nombre: "Pizza de la casa", precio: 12000, descripcion: "Salsa de tomate, doble mozzarella, jamón cocido, morrón, aceitunas, huevo frito y orégano." },
  ] },
  { icono: "🍟", nombre: "Papas Fritas", imagen: "/img/papas-fritas.webp", productos: [
    { nombre: "Papas fritas clásicas (individual)", precio: 5000, descripcion: "Porción individual." },
    { nombre: "Papas fritas especiales (individual)", precio: 7000, descripcion: "Porción individual." },
    { nombre: "Papas fritas clásicas (para compartir)", precio: 8000, descripcion: "Porción para compartir." },
    { nombre: "Papas fritas especiales (para compartir)", precio: 10000, descripcion: "Porción para compartir." },
    { nombre: "Papas fritas clásicas (familiar)", precio: 15000, descripcion: "Porción familiar." },
    { nombre: "Papas fritas especiales (familiar)", precio: 18000, descripcion: "Porción familiar." },
  ] },
  { icono: "🥘", nombre: "Salchipapas", imagen: "", productos: [
    { nombre: "Salchipapa clásica", precio: 8000, descripcion: "Salchicha y papas fritas." },
    { nombre: "Salchipapa especial", precio: 10000, descripcion: "Salchicha, papas fritas, queso cheddar y salsas de la casa." },
  ] },
  { icono: "🥪", nombre: "Tostados", imagen: "", productos: [
    { nombre: "Tostado clásico", precio: 5000, descripcion: "Pan de molde, manteca, jamón cocido y queso." },
    { nombre: "Tostado especial", precio: 6000, descripcion: "Pan de molde, manteca, jamón cocido, queso y tomate." },
    { nombre: "Tostado de ternera", precio: 10000, descripcion: "Pan de molde, mayonesa casera, tomate, lechuga y mucha ternera." },
  ] },
  { icono: "🌯", nombre: "Sándwich Árabe", imagen: "", productos: [
    { nombre: "Sándwich árabe", precio: 10000, descripcion: "Jamón, queso, lechuga, tomate y mayonesa." },
    { nombre: "Sándwich árabe de ternera", precio: 12000, descripcion: "Mucha ternera, lechuga, tomate y mayonesa." },
  ] },
  { icono: "🥖", nombre: "Sándwiches Salados", imagen: "", productos: [
    { nombre: "Carlitos", precio: 4000, descripcion: "Tostado de pan de miga con jamón, queso y manteca." },
    { nombre: "Croissant (sándwich)", precio: 5000, descripcion: "Relleno con jamón y queso." },
    { nombre: "Medialunas rellenas", precio: 3000, descripcion: "Con jamón y queso." },
    { nombre: "Croissant especial", precio: 7000, descripcion: "Relleno de palta + huevo + tomate cherry." },
    { nombre: "El Tostón", precio: 5500, descripcion: "Jamón + queso + tomate + mayonesa." },
  ] },
  { icono: "🥞", nombre: "Desayunos & Meriendas", imagen: "/img/medialunas.webp", productos: [
    { nombre: "French", precio: 4000, descripcion: "Infusión + 2 medialunas o 2 tortillitas." },
    { nombre: "French Croissant", precio: 5500, descripcion: "Infusión + 1 croissant." },
    { nombre: "Clásico Light", precio: 6000, descripcion: "Infusión + 2 tostadas + mermelada del día + queso + jugo de naranja + ensalada de fruta + soda o agua." },
    { nombre: "Campiña", precio: 5500, descripcion: "Infusión + pan de campo + dulce de leche + manteca + jugo de naranja + soda o agua." },
    { nombre: "Dulcero", precio: 7500, descripcion: "Infusión + torta o tarta del día." },
    { nombre: "Bowl de Yogur", precio: 7000, descripcion: "Yogur + frutas de estación + granola + miel o pasta de maní." },
    { nombre: "Proteico", precio: 9500, descripcion: "Infusión + tostadas integral + huevos revueltos + jamón y queso + fruta de estación + jugo de naranja + soda o agua." },
    { nombre: "Avocado", precio: 7000, descripcion: "Infusión + tostadas + huevos revueltos + palta + tomate cherry + queso crema + nueces." },
    { nombre: "Torre Mixta (para compartir)", precio: 21000, descripcion: "2 infusiones + cookies + brownie + jugo + soda + medialunas + pan de campo + jamón + queso." },
    { nombre: "Full Fit", precio: 10500, descripcion: "Infusión + panqueque de avena (chocolate o vainilla) + fruta de estación + miel o pasta de maní + jugo de naranja + soda o agua." },
    { nombre: "Desayuno Chicha Candela", precio: 9900, descripcion: "Infusión + 1 medialuna + cookie + porción de torta del día + fruta de estación + jugo de naranja + soda o agua. Un desayuno muy dulce, en honor a nuestra Chicha Candela." },
  ] },
  { icono: "☕", nombre: "Cafetería", imagen: "/img/cafe.webp", productos: [
    { nombre: "Espresso", precio: 2000 }, { nombre: "Espresso mediano", precio: 2500 }, { nombre: "Americano", precio: 3000 },
    { nombre: "Cortado", precio: 2500 }, { nombre: "Lágrima", precio: 2000 }, { nombre: "Lágrima mediana", precio: 2500 },
    { nombre: "Capuchino", precio: 3500 }, { nombre: "Frappé", precio: 7000 }, { nombre: "Chocolatada", precio: 4000 },
    { nombre: "Submarino", precio: 4500 }, { nombre: "Latte", precio: 3500 }, { nombre: "Latte de Caramelo", precio: 4000 },
    { nombre: "Latte de Vainilla", precio: 4000 }, { nombre: "Latte de Pistacho", precio: 4500 },
    { nombre: "Latte de Frambuesa", precio: 4500 }, { nombre: "Iced Latte", precio: 4500 },
  ] },
  { icono: "🥐", nombre: "Panadería", imagen: "/img/medialunas.webp", productos: [
    { nombre: "Medialunas dulces", precio: 800 }, { nombre: "Medialunas saladas", precio: 800 }, { nombre: "Tortillitas", precio: 600 },
    { nombre: "Pan de campo", precio: 750 }, { nombre: "Chipa", precio: 3400 }, { nombre: "Croissant", precio: 3000 },
    { nombre: "Croissant rellenos", precio: 4000, descripcion: "Disponibles del día." },
    { nombre: "Muffins (chocolate o vainilla)", precio: 3500 }, { nombre: "Alfajores de chocolate", precio: 3000 },
    { nombre: "Cookies de vainilla y chips de chocolate", precio: 2500 }, { nombre: "Cookie Oreo", precio: 2500 },
    { nombre: "Cookies Red Velvet", precio: 2500 }, { nombre: "Rolls de canela", precio: 3500 },
  ] },
  // En la carta solo el brownie tiene precio ("consultá en el mostrador"). Los demás quedan PAUSADOS con precio 0:
  // cuando les pongas precio en Menú, tildá "Disponible" y aparecen en el menú.
  { icono: "🍰", nombre: "Tortas & Dulces del Día", imagen: "", productos: [
    { nombre: "Brownie", precio: 3500 },
    ...["Cheesecake", "Invertida de manzana", "Cabsha", "Tarta de coco", "Tarta Oreo"].map((nombre) => ({ nombre, precio: 0, activo: false, descripcion: "Consultá el precio en el mostrador." })),
  ] },
  { icono: "🥤", nombre: "Bebidas", imagen: "", productos: [
    { nombre: "Coca-Cola lata (350 cc)", precio: 2500, imagen: COCA },
    { nombre: "Coca-Cola / Fanta / Sprite (350 cc)", precio: 3000, imagen: COCA },
    { nombre: "Coca-Cola Zero (350 cc)", precio: 3000, imagen: COCA },
    { nombre: "Coca-Cola / Fanta / Sprite (1 litro)", precio: 5000, imagen: COCA },
    { nombre: "Coca-Cola Zero (1 litro)", precio: 5000, imagen: COCA },
    { nombre: "Agua mineral (600 cc)", precio: 3000 },
    { nombre: "Agua mineral c/ gas (600 cc)", precio: 3000 },
    { nombre: "Agua saborizada de pera (600 cc)", precio: 3000 },
    { nombre: "Agua saborizada de pera (1,5 litro)", precio: 5500 },
    { nombre: "Jugo Cepita (300 cc)", precio: 2500 },
    { nombre: "Cerveza lata Estrella Galicia lager", precio: 4500 },
    { nombre: "Cerveza lata Pampa Lager", precio: 4500 },
    { nombre: "Cerveza lata Pampa Dorada", precio: 4500 },
    { nombre: "Limonada", precio: 5500 },
    { nombre: "Jugo de naranja", precio: 4000 },
    { nombre: "Jarra de limonada", precio: 9500 },
  ] },
  { icono: "🍹", nombre: "Licuados", imagen: "", productos: [
    { nombre: "Licuado de banana", precio: 4000 }, { nombre: "Licuado de frutilla", precio: 4000 }, { nombre: "Licuado de ananá", precio: 5000 },
    { nombre: "Licuado de durazno", precio: 5000 }, { nombre: "Licuado de tutti frutti", precio: 4000 }, { nombre: "Licuado de maracuyá", precio: 5000 },
  ] },
  { icono: "🫐", nombre: "Smoothies", imagen: "", productos: [
    { nombre: "Smoothie Rojo", precio: 7000 }, { nombre: "Smoothie Amarillo", precio: 7000 }, { nombre: "Smoothie Violeta", precio: 7500 },
  ] },
];
