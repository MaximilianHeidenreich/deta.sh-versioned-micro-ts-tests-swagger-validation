const express = require("express")
const swaggerUi = require("swagger-ui-express")
const OpenApiValidator = require("express-openapi-validator")
import { existsSync } from "fs"

// Route imports
import { getIncrement } from "./increment"

const API_VERSION = "v1"
const API_SPEC_FILE = `${__dirname}/lib/routes/${API_VERSION}/spec.yaml`
export const router = express.Router()

// Router middleware
// router.user(rateLimit())

console.log(`API Route (${API_VERSION}) - Use OpenAPI Validation: ${existsSync(API_SPEC_FILE)}`)
console.log(`API Route (${API_VERSION}) - Use OpenAPI SwaggerUI Docs: ${existsSync(API_SPEC_FILE)}`)

if (existsSync(API_SPEC_FILE)) {
	router.get("/spec.yaml", (req: any, res: any) => res.sendFile(API_SPEC_FILE))
	router.get("/spec.json", (req: any, res: any) => res.sendFile(API_SPEC_FILE))

	// OpenAPI Validation
	router.use(
		OpenApiValidator.middleware({
			apiSpec: `./lib/routes/${API_VERSION}/spec.yaml`,
			validateRequests: true,
			validateResponses: true,
			ignoreUndocumented: true,
		})
	)
	router.use((err: any, req: any, res: any, next: any) => {
		res.status(err.status || 500).json({
			msg: err.message,
			err: err.errors,
		})
	})

	// OpenAPI SwaggerUI Docs
	router.use("/docs", swaggerUi.serve)
	router.get(
		"/docs",
		swaggerUi.setup(require(`${__dirname}/lib/routes/${API_VERSION}/spec.json`), {
			explorer: false,
		})
	)
}

// Routes
router.get("/increment/:number", getIncrement)
