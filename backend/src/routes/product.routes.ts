import { Router } from "express";
import { productController } from "../controllers/product.controller.js";
import { route } from "../middleware/async-handler.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  updateProductSchema,
} from "../validation/product.validation.js";

export const productRoutes = Router();

productRoutes.use(authenticate);

productRoutes.get(
  "/",
  ...route(requirePermission("product.view_all"), validate({ query: listProductsQuerySchema }), productController.list),
);

productRoutes.post(
  "/",
  ...route(requirePermission("product.create"), validate({ body: createProductSchema }), productController.create),
);

productRoutes.get(
  "/:id",
  ...route(requirePermission("product.view_all"), validate({ params: productIdParamsSchema }), productController.getById),
);

productRoutes.patch(
  "/:id",
  ...route(
    requirePermission("product.update"),
    validate({ params: productIdParamsSchema, body: updateProductSchema }),
    productController.update,
  ),
);

productRoutes.delete(
  "/:id",
  ...route(requirePermission("product.delete"), validate({ params: productIdParamsSchema }), productController.delete),
);
