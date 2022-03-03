///
///     Dev server for local testing.
///     -> Automatically copied into ./build
///     -> Start with npm run dev
///
console.log("\n\nStarting dev server...");
const app = require("./index.js")
const PORT = 3000

app.listen(PORT, () => {
    console.log(`Dev server running on port ${PORT}`)
})