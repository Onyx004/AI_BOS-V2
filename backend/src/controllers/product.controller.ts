import { productService } from "../services/product.service.js";
import { jsonController } from "../utils/controller.js";
import type { ListProductsQuery } from "../validation/product.validation.js";

export class ProductController {
  list = jsonController(200, "Products fetched successfully", ({ req }) =>
    productService.list(req.query as unknown as ListProductsQuery),
  );

  create = jsonController(201, "Product created successfully", ({ req }) =>
    productService.create(req.body, req.user?.id),
  );

  getById = jsonController(200, "Product fetched successfully", ({ req }) =>
    productService.getById(req.params.id),
  );

  update = jsonController(200, "Product updated successfully", ({ req }) =>
    productService.update(req.params.id, req.body),
  );

  delete = jsonController(200, "Product deleted successfully", ({ req }) =>
    productService.delete(req.params.id),
  );
}

export const productController = new ProductController();
