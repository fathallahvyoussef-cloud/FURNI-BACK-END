

const axios = require("axios");


// you later split them onto different servers.
const CATALOG_API = process.env.CATALOG_API_URL;
const CART_API = process.env.CART_API_URL;


const httpClient = axios.create({ timeout: 5000 });


 
function isValidProductId(id) {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

/**
 * Trim a raw Furni product record down to what the model needs to reason
 * about. Real shape confirmed from GET /products:
 *   { _id, name, price, description, qte, image, __v }
 * Notably: no `inStock` boolean (derived from `qte`), no `category`,
 * `tags`, `rating`, or `currency` fields, and `image` is a single URL,
 * not a variant array.
 */
function toModelProduct(p) {
  return {
    id: p._id,
    name: p.name,
    price: p.price,
    description: p.description,
    image: p.image,
    inStock: (p.qte ?? 0) > 0,
    stockCount: p.qte
  };
}

/**
 * GET /products appears to return the FULL catalog with no query-param
 * filtering (confirmed by inspecting the live response) — so search,
 * price filtering, etc. all happen here in our own code instead of
 * relying on server-side params the API doesn't seem to support.
 *
 * This is fine for a small catalog; if the real catalog grows into the
 * hundreds+, this should be replaced with real server-side search/paging
 * once that exists on the Furni backend.
 */
async function fetchAllProducts() {
  const { data } = await httpClient.get(`${CATALOG_API}/products`);
  return Array.isArray(data) ? data : [];
}

async function searchProducts(input) {
  const all = await fetchAllProducts();

  // Split into individual words rather than matching the whole phrase as one
  // exact substring — a query like "red velvet sofa" should match "Classic
  // Red Velvet Chesterfield Sofa" even though "red velvet sofa" never
  // appears contiguously in that name. Every word must be present
  // SOMEWHERE in the name+description, in any order.
  const queryTerms = (input.query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const filtered = all.filter((p) => {
    const haystack = `${p.name} ${p.description}`.toLowerCase();
    const matchesQuery = queryTerms.length === 0 || queryTerms.every((term) => haystack.includes(term));
    const matchesMin = input.min_price == null || p.price >= input.min_price;
    const matchesMax = input.max_price == null || p.price <= input.max_price;
    return matchesQuery && matchesMin && matchesMax;
  });

  return {
    count: filtered.length,
    products: filtered.slice(0, 8).map(toModelProduct)
  };
}

async function getProductDetails(input) {
  if (!isValidProductId(input.product_id)) {
    return {
      error: true,
      message:
        `"${input.product_id}" is not a valid product id — it looks like a display number, not a real product id. ` +
        `Use the actual "id" field from a previous search_products or compare_products result for this item.`
    };
  }

  // Falls back to filtering the full list rather than assuming a
  // GET /products/:id endpoint exists — not yet confirmed against the
  // real API. Swap this for a direct lookup once that's verified.
  const all = await fetchAllProducts();
  const product = all.find((p) => p._id === input.product_id);

  if (!product) {
    return { error: true, message: "Product not found." };
  }

  return toModelProduct(product);
}

async function compareProducts(input) {
  const invalidIds = input.product_ids.filter((id) => !isValidProductId(id));
  if (invalidIds.length > 0) {
    return {
      error: true,
      message:
        `These are not valid product ids: ${invalidIds.join(", ")}. ` +
        `Use the actual "id" field from a previous search_products result, not a display number.`
    };
  }

  const all = await fetchAllProducts();
  const products = input.product_ids
    .map((id) => all.find((p) => p._id === id))
    .filter(Boolean)
    .map(toModelProduct);

  return { products };
}

async function addToCart(input, session) {
  if (!isValidProductId(input.product_id)) {
    return {
      error: true,
      message:
        `"${input.product_id}" is not a valid product id — it looks like a display number, not a real product id. ` +
        `Find the real "id" field for this product from the most recent search_products result and use that instead.`
    };
  }

  // The real /carts/add endpoint hard-requires a logged-in userId — there
  // is no guest-cart path on this API. If the customer isn't logged in,
  // fail clearly rather than sending a request we know will be rejected.
  if (!session.userId) {
    return {
      error: true,
      message: "The customer needs to be logged in to add items to their cart. Ask them to log in first."
    };
  }

  // The real endpoint requires the product's current price in the request
  // body (not just its id) — look it up rather than trusting a price the
  // model might be carrying from an earlier turn, which could be stale.
  const all = await fetchAllProducts();
  const product = all.find((p) => p._id === input.product_id);
  if (!product) {
    return { error: true, message: "Product not found." };
  }

  const { data } = await httpClient.post(`${CART_API}/carts/add`, {
    userId: session.userId,
    product: { _id: product._id, price: product.price },
    quantity: input.quantity || 1
  });

  return { success: true, message: data.message, cart: data.cart };
}

async function getCart(_input, session) {
  if (!session.userId) {
    console.log("no userId in session, cannot fetch cart")
    return {
      
      error: true,
      message: "The customer needs to be logged in to view their cart. Ask them to log in first."
    };
  }

  // No dedicated "get this one user's cart" endpoint exists on the real
  // API — GET /carts returns every customer's cart (populated with
  // product name/price/qte/image), so we fetch all and filter to this
  // user's own cart client-side, same pattern as product search.
  const { data: allCarts } = await httpClient.get(`${CART_API}/carts`);
  const cart = allCarts.find((c) => c.userId?._id === session.userId || c.userId === session.userId);

  if (!cart) {
    return { itemCount: 0, subtotal: 0, items: [] };
  }

  const items = cart.items.map((item) => ({
    productId: item.productId?._id,
    name: item.productId?.name,
    price: item.price,
    quantity: item.quantity,
    image: item.productId?.image
  }));
  

  return {
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    items
  };
}

const HANDLERS = {
  search_products: searchProducts,
  get_product_details: getProductDetails,
  compare_products: compareProducts,
  add_to_cart: addToCart,
  get_cart: getCart
};

/**
 * @param {string} name - tool name from Claude's tool_use block
 * @param {object} input - tool input from Claude's tool_use block
 * @param {{ cartId: string, userId?: string }} session
 */
async function executeTool(name, input, session) {
  const handler = HANDLERS[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    return await handler(input, session);
  } catch (err) {
    const isTimeoutOrUnreachable = err.code === "ECONNABORTED" || err.code === "ECONNREFUSED";

    console.error(
      `[toolHandlers] "${name}" failed${isTimeoutOrUnreachable ? " (unreachable/timeout — check CATALOG_API_URL / CART_API_URL in .env)" : ""}:`,
      err.message
    );

    // Return a structured error *to the model* rather than throwing —
    // this lets the model explain the problem to the customer sensibly
    // ("that item looks out of stock") instead of the request hard-failing.
    return {
      error: true,
      message: isTimeoutOrUnreachable
        ? "The product catalog service is temporarily unavailable."
        : err.response?.data?.message || err.message
    };
    };
  }


module.exports = { executeTool };