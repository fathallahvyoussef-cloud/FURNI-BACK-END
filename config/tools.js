
const tools = [
  {
    name: "search_products",
    description:
      "Search the store's product catalog. Use this whenever the customer describes " +
      "something they're looking for, even loosely (use case, price range, attributes). " +
      "Returns a shortlist of matching products with price, rating, and stock status.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text search, e.g. 'waterproof hiking jacket'"
        },
        category: {
          type: "string",
          description: "Optional category filter, e.g. 'outerwear'"
        },
        min_price: { type: "number" },
        max_price: { type: "number" },
        attributes: {
          type: "array",
          items: { type: "string" },
          description: "Desired attributes/tags, e.g. ['waterproof', 'breathable', 'packable']"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_product_details",
    description:
      "Fetch full details for a single product by ID — specs, materials, size chart, " +
      "reviews summary, exact stock/variant availability. Use this before making a " +
      "confident recommendation or before adding an item to the cart.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string" }
      },
      required: ["product_id"]
    }
  },
  {
    name: "compare_products",
    description:
      "Fetch details for multiple product IDs at once so they can be compared side by side. " +
      "Use when the customer is choosing between two or more specific items.",
    input_schema: {
      type: "object",
      properties: {
        product_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 2
        }
      },
      required: ["product_ids"]
    }
  },
  {
    name: "add_to_cart",
    description:
      "Add a product (with an optional variant, e.g. size/color) to the customer's cart. " +
      "Only call this after the customer has confirmed they want a specific item — " +
      "don't add items on their behalf just because they were mentioned or compared.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        quantity: { type: "number", default: 1 },
        variant: { type: "string", description: "Size/color/SKU variant, if applicable" }
      },
      required: ["product_id"]
    }
  },
  {
    name: "get_cart",
    description: "Get the current contents of the customer's cart.",
    input_schema: { type: "object", properties: {} }
  }
];

module.exports = tools;