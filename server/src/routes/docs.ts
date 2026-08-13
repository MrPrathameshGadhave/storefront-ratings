import express, { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "../lib/openapi.js";

export const docsRouter: Router = express.Router();

// Serve OpenAPI JSON specification
docsRouter.get("/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});

// Serve Swagger UI documentation
docsRouter.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customCss: `
    .swagger-ui .topbar {
      display: none;
    }
    body {
      background-color: #f5f5f5;
    }
  `,
    customSiteTitle: "Storefront Ratings API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      displayOperationId: false,
    },
  }),
);
