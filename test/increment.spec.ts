import { describe } from "mocha"
import { expect } from "chai"
import increment from "../src/lib/increment"

describe("Math", () => {
	describe("Add", () => {
		it("Should return 6 when a = 5", () => {
			var result = increment(5)

			expect(result).to.equal(6)
		})
	})
})
