import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:6060/api/v1";
const PRODUCT_P95_TARGET_MS = Number(__ENV.PRODUCT_P95_TARGET_MS || 2000);
const POST_RECOVERY_DURATION = __ENV.POST_RECOVERY_DURATION || "60s";

// Amos Chee Tian Ee, A0273476U - Recovery product test cases and thresholds.
export const options = {
  vus: Number(__ENV.VUS || 30),
  duration: POST_RECOVERY_DURATION,
  thresholds: {
    "http_req_duration{endpoint:get-product}": [`p(95)<${PRODUCT_P95_TARGET_MS}`],
    "http_req_duration{endpoint:product-list}": [`p(95)<${PRODUCT_P95_TARGET_MS}`],
    checks: ["rate>0.95"],
    http_req_failed: ["rate<0.05"],
  },
};

function safeJson(response) {
  if (!response || !response.body) {
    return null;
  }

  try {
    return response.json();
  } catch (_error) {
    return null;
  }
}

function hasUniqueIds(list) {
  const ids = list.map((item) => item && item._id).filter(Boolean);
  return ids.length === new Set(ids).size;
}

function hasNoCorruption(list) {
  return list.every((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    if (!item._id || !item.name || typeof item.price !== "number") {
      return false;
    }

    return true;
  });
}

export default function () {
  const allProductsRes = http.get(`${BASE_URL}/product/get-product`, {
    tags: { endpoint: "get-product", scenario: "product_recovery" },
  });
  const allProductsBody = safeJson(allProductsRes);
  const products = allProductsBody && Array.isArray(allProductsBody.products) ? allProductsBody.products : [];

  // Amos Chee Tian Ee, A0273476U - Product catalog recovery test cases.
  check(allProductsRes, {
    "get-product returns 200": (r) => r.status === 200,
    "get-product response has products array": () => Array.isArray(products),
    "get-product has unique ids": () => hasUniqueIds(products),
    "get-product has no obvious corruption": () => products.length === 0 || hasNoCorruption(products),
  });

  const pageRes = http.get(`${BASE_URL}/product/product-list/1`, {
    tags: { endpoint: "product-list", scenario: "product_recovery" },
  });
  const pageBody = safeJson(pageRes);
  const pageProducts = pageBody && Array.isArray(pageBody.products) ? pageBody.products : [];

  // Amos Chee Tian Ee, A0273476U - Product page availability recovery test cases.
  check(pageRes, {
    "product-list returns 200": (r) => r.status === 200,
    "product-list returns products array": () => Array.isArray(pageProducts),
    "product-list has unique ids": () => hasUniqueIds(pageProducts),
    "product-list has no obvious corruption": () =>
      pageProducts.length === 0 || hasNoCorruption(pageProducts),
  });

  sleep(0.4);
}
