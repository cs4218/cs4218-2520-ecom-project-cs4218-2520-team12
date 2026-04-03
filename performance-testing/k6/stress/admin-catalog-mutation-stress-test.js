// Snodgrass Eliot Peter, A0269684H
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:6060/api/v1';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL;
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD;

const PEAK_VUS = Number(__ENV.PEAK_VUS || 400);
const WRITE_P95_TARGET_MS = Number(__ENV.WRITE_P95_TARGET_MS || 2500);
const SERVER_5XX_TARGET = Number(__ENV.SERVER_5XX_TARGET || 0.02);
const CHECK_RATE_TARGET = Number(__ENV.CHECK_RATE_TARGET || 0.95);

const writeOperationDuration = new Trend('write_operation_duration');
const serverErrorRate = new Rate('server_error_rate');
const validation4xxRate = new Rate('validation_4xx_rate');

function buildStressStages(peakVus) {
    const l1 = Math.max(25, Math.floor(peakVus * 0.2));
    const l2 = Math.max(50, Math.floor(peakVus * 0.4));
    const l3 = Math.max(75, Math.floor(peakVus * 0.6));
    const l4 = Math.max(100, Math.floor(peakVus * 0.8));

    return [
        { duration: '30s', target: l1 },
        { duration: '1m', target: l2 },
        { duration: '1m', target: l3 },
        { duration: '1m', target: l4 },
        { duration: '1m', target: peakVus },
        { duration: '45s', target: 0 },
    ];
}

export const options = {
    stages: buildStressStages(PEAK_VUS),
    thresholds: {
        write_operation_duration: [`p(95)<${WRITE_P95_TARGET_MS}`],
        server_error_rate: [`rate<${SERVER_5XX_TARGET}`],
        checks: [`rate>${CHECK_RATE_TARGET}`],
    },
};

function safeJsonBody(response) {
    if (!response || !response.body) {
        return null;
    }

    try {
        return response.json();
    } catch (error) {
        return null;
    }
}

function recordWriteMetrics(response, operation) {
    const duration = response && response.timings ? response.timings.duration : 0;
    writeOperationDuration.add(duration, { operation });
    serverErrorRate.add(response && response.status >= 500, { operation });
    validation4xxRate.add(response && response.status >= 400 && response.status < 500, { operation });
}

function authHeaders(token) {
    return {
        Authorization: token,
        'Content-Type': 'application/json',
    };
}

function createUniqueName(prefix) {
    return `${prefix}-${Date.now()}-${__VU}-${__ITER}-${Math.floor(Math.random() * 100000)}`;
}

function verifyProductCategoryIntegrity(token, productSlug, expectedCategoryId) {
    const singleRes = http.get(`${BASE_URL}/product/get-product/${productSlug}`, {
        headers: authHeaders(token),
        tags: { flow: 'admin-mutation', operation: 'verify-single-product' },
    });
    serverErrorRate.add(singleRes && singleRes.status >= 500, { operation: 'verify-single-product' });
    const singleBody = safeJsonBody(singleRes);

    // Snodgrass Eliot Peter, A0269684H
    return check(singleRes, {
        'single product status is 200': (r) => r.status === 200,
        'single product has populated category': () => !!(singleBody && singleBody.product && singleBody.product.category),
        'single product category id matches expected': () => {
            const category = singleBody && singleBody.product && singleBody.product.category;
            if (!category) {
                return false;
            }

            return String(category._id) === String(expectedCategoryId);
        },
    });
}

export function setup() {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD. Provide admin credentials via env vars.');
    }

    const payload = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const res = http.post(`${BASE_URL}/auth/login`, payload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { flow: 'admin-mutation', operation: 'admin-login-setup' },
    });
    const body = safeJsonBody(res);

    // Snodgrass Eliot Peter, A0269684H
    const ok = check(res, {
        'admin setup login status is 200': (r) => r.status === 200,
        'admin setup returns token': () => !!(body && body.token),
        'admin setup user role is admin': () => !!(body && body.user && body.user.role === 1),
    });

    if (!ok || !body || !body.token || !body.user || body.user.role !== 1) {
        throw new Error('Admin setup failed. Ensure ADMIN_EMAIL/ADMIN_PASSWORD belong to an admin user.');
    }

    return { token: body.token };
}

export default function (data) {
    const token = data.token;
    const categoryName = createUniqueName('stress-cat');
    const updatedCategoryName = createUniqueName('stress-cat-upd');
    const productName = createUniqueName('stress-product');
    const updatedProductName = createUniqueName('stress-product-upd');

    // 1) Create category
    const createCategoryRes = http.post(
        `${BASE_URL}/category/create-category`,
        JSON.stringify({ name: categoryName }),
        {
            headers: authHeaders(token),
            tags: { flow: 'admin-mutation', operation: 'create-category' },
        }
    );
    recordWriteMetrics(createCategoryRes, 'create-category');
    const createCategoryBody = safeJsonBody(createCategoryRes);

    // Snodgrass Eliot Peter, A0269684H
    const createCategoryOk = check(createCategoryRes, {
        'create category status is 201': (r) => r.status === 201,
        'create category returns id': () => !!(createCategoryBody && createCategoryBody.category && createCategoryBody.category._id),
    });

    if (!createCategoryOk) {
        sleep(1);
        return;
    }

    const categoryId = createCategoryBody.category._id;
    let categorySlug = createCategoryBody.category.slug;

    // 2) Create product in that category
    const createProductPayload = {
        name: productName,
        description: 'Admin mutation stress test product',
        price: '55',
        category: categoryId,
        quantity: '15',
        shipping: 'true',
    };

    const createProductRes = http.post(`${BASE_URL}/product/create-product`, createProductPayload, {
        headers: {
            Authorization: token,
        },
        tags: { flow: 'admin-mutation', operation: 'create-product' },
    });
    recordWriteMetrics(createProductRes, 'create-product');
    const createProductBody = safeJsonBody(createProductRes);

    // Snodgrass Eliot Peter, A0269684H
    const createProductOk = check(createProductRes, {
        'create product status is 201': (r) => r.status === 201,
        'create product returns id': () => !!(createProductBody && createProductBody.products && createProductBody.products._id),
        'create product has slug': () => !!(createProductBody && createProductBody.products && createProductBody.products.slug),
    });

    if (!createProductOk) {
        sleep(1);
        return;
    }

    const productId = createProductBody.products._id;
    let productSlug = createProductBody.products.slug;

    // 3) Update category (covers category update mutation path)
    const updateCategoryRes = http.put(
        `${BASE_URL}/category/update-category/${categoryId}`,
        JSON.stringify({ name: updatedCategoryName }),
        {
            headers: authHeaders(token),
            tags: { flow: 'admin-mutation', operation: 'update-category' },
        }
    );
    recordWriteMetrics(updateCategoryRes, 'update-category');
    const updateCategoryBody = safeJsonBody(updateCategoryRes);

    // Snodgrass Eliot Peter, A0269684H
    check(updateCategoryRes, {
        'update category status is 200': (r) => r.status === 200,
        'update category returns new slug': () => !!(updateCategoryBody && updateCategoryBody.category && updateCategoryBody.category.slug),
    });

    if (updateCategoryBody && updateCategoryBody.category && updateCategoryBody.category.slug) {
        categorySlug = updateCategoryBody.category.slug;
    }

    // 4) Update product (covers product update mutation path)
    const updateProductPayload = {
        name: updatedProductName,
        description: 'Updated admin mutation stress test product',
        price: '65',
        category: categoryId,
        quantity: '18',
        shipping: 'true',
    };

    const updateProductRes = http.put(`${BASE_URL}/product/update-product/${productId}`, updateProductPayload, {
        headers: {
            Authorization: token,
        },
        tags: { flow: 'admin-mutation', operation: 'update-product' },
    });
    recordWriteMetrics(updateProductRes, 'update-product');
    const updateProductBody = safeJsonBody(updateProductRes);

    // Snodgrass Eliot Peter, A0269684H
    const updateProductOk = check(updateProductRes, {
        'update product status is 201': (r) => r.status === 201,
        'update product returns new slug': () => !!(updateProductBody && updateProductBody.products && updateProductBody.products.slug),
    });

    if (updateProductOk && updateProductBody && updateProductBody.products && updateProductBody.products.slug) {
        productSlug = updateProductBody.products.slug;
    }

    // 5) Integrity checks: product->category mapping and category->product discoverability
    const productIntegrityOk = verifyProductCategoryIntegrity(token, productSlug, categoryId);

    const productByCategoryRes = http.get(`${BASE_URL}/product/product-category/${categorySlug}`, {
        headers: authHeaders(token),
        tags: { flow: 'admin-mutation', operation: 'verify-product-category-link' },
    });
    serverErrorRate.add(productByCategoryRes && productByCategoryRes.status >= 500, {
        operation: 'verify-product-category-link',
    });
    const productByCategoryBody = safeJsonBody(productByCategoryRes);

    // Snodgrass Eliot Peter, A0269684H
    const categoryLinkOk = check(productByCategoryRes, {
        'product-category status is 200': (r) => r.status === 200,
        'product-category has products array': () =>
            !!(productByCategoryBody && Array.isArray(productByCategoryBody.products)),
        'product-category contains updated product': () => {
            if (!productByCategoryBody || !Array.isArray(productByCategoryBody.products)) {
                return false;
            }

            return productByCategoryBody.products.some((p) => String(p && p._id) === String(productId));
        },
    });

    // 6) Delete product and category (covers delete mutation path)
    const deleteProductRes = http.delete(`${BASE_URL}/product/delete-product/${productId}`, null, {
        headers: authHeaders(token),
        tags: { flow: 'admin-mutation', operation: 'delete-product' },
    });
    recordWriteMetrics(deleteProductRes, 'delete-product');

    // Snodgrass Eliot Peter, A0269684H
    check(deleteProductRes, {
        'delete product status is 200': (r) => r.status === 200,
    });

    const deleteCategoryRes = http.delete(`${BASE_URL}/category/delete-category/${categoryId}`, null, {
        headers: authHeaders(token),
        tags: { flow: 'admin-mutation', operation: 'delete-category' },
    });
    recordWriteMetrics(deleteCategoryRes, 'delete-category');

    // Snodgrass Eliot Peter, A0269684H
    check(deleteCategoryRes, {
        'delete category status is 200': (r) => r.status === 200,
    });

    // 7) Post-run style sampled correctness checks on global catalog shape
    if (productIntegrityOk && categoryLinkOk && Math.random() < 0.25) {
        const allProductsRes = http.get(`${BASE_URL}/product/get-product`, {
            headers: authHeaders(token),
            tags: { flow: 'admin-mutation', operation: 'verify-global-catalog-shape' },
        });
        serverErrorRate.add(allProductsRes && allProductsRes.status >= 500, { operation: 'verify-global-catalog-shape' });
        const allProductsBody = safeJsonBody(allProductsRes);

        // Snodgrass Eliot Peter, A0269684H
        check(allProductsRes, {
            'global catalog status is 200': (r) => r.status === 200,
            'global catalog products have category references': () => {
                if (!allProductsBody || !Array.isArray(allProductsBody.products)) {
                    return false;
                }

                return allProductsBody.products.every((p) => p && p.category);
            },
        });
    }

    sleep(1);
}