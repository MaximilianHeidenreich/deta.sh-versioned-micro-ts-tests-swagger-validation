const express = require("express")
const cors = require("cors")
import { readdirSync } from "fs"

const app = express()
app.locals.env = process.env.ENVIRONMENT
app.use(cors())
app.use(express.json())
app.use(express.text())
//app.use(express.urlencoded({ extended: false }))

// Mount routers
const routeDirs: string[] = readdirSync("./lib/routes", { withFileTypes: true })
	.filter((e: any) => e.isDirectory())
	.map((e: any) => e.name)

routeDirs.forEach((routeDir) => {
	console.log(`Mounting router /${routeDir}`)
	try {
		const router = require(`./lib/routes/${routeDir}/router`)
		app.use(`/${routeDir}`, router.router)
	} catch (e) {
		console.error(`Could not mount rounter ${routeDir}`)
		console.error(e)
		process.exit(1)
	}
})

module.exports = app
