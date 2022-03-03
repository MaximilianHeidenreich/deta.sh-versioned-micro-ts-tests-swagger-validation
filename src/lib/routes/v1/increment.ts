import type { Request, Response } from "express"
import increment from "../../../lib/increment"

export async function getIncrement(req: Request, res: Response) {
	const { number } = req.params
	const environment = req.app.locals.env
	res.send(
		JSON.stringify(
			{
				environment,
				"num+1": increment(Number.parseInt(number)),
				onlyInSandbox: environment === "sandbox" ? "cool debug data" : undefined,
			},
			undefined,
			4
		)
	)
}
