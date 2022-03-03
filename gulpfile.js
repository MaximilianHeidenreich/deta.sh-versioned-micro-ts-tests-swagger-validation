const { src, series, dest } = require("gulp");
const fs = require("fs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const inquirer = require("inquirer");
const yaml = require("gulp-yaml");
const rename = require("gulp-rename");
const del = require("del");
const gulpEsbuild = require("gulp-esbuild")
const { nodeExternalsPlugin } = require("esbuild-node-externals");
const { micro_name, deta_project, environments } = require("./deta.json")

// Only run task when prompt is truthy
// Calls taskFn if given (must be gulp task) / Resolves to true / false
async function prompt(message) {
    const answers = await inquirer.prompt([{
        type: "confirm",
        message,
        default: true,
        name: "prompt"
    }])
    if (!answers.prompt) {
        return false
    }
    return true
}

// Prepares build folder for given env
function prepareBuild(env) {
    return async function prepareBuild() {
        console.log(`prepareBuild() | ENV: ${env}`);
        fs.mkdirSync(`./build/${env}`, { recursive: true });
        await del([`./build/${env}/**`, `!${env}`, "!.deta"], { force: true })
        Promise.resolve()
    }
}

// Meta files
function metaFiles(env) {
    return async function metaFiles() {
        console.log(`metaFiles() | ENV: ${env}`);
        src("./src/**/spec.yaml")
            .pipe(yaml({ space: 2 }))
            .pipe(dest(`./build/${env}`))
        src("./src/devServer.js").pipe(dest(`./build/${env}`))
        src("./src/**/*.yaml")
            .pipe(dest(`./build/${env}`))
        src("./package.json").pipe(dest(`./build/${env}`))
        src("./.detaignore").pipe(dest(`./build/${env}`))
        src(`./.${env}.env`).pipe(rename(".env")).pipe(dest(`./build/${env}`))
        Promise.resolve()
    }
}

// Builds project into env folder
function build(env) {
    return async function build() {
        console.log(`build() | ENV: ${env}`);
        src("./src/**/*.ts")   // TODO: Bundle?
            .pipe(gulpEsbuild({
                //outfile: "index.js",
                bundle: false,
                platform: "node",
                target: "node12",
                format: "cjs",
                splitting: false,
                plugins: [nodeExternalsPlugin()],
            }))
            .pipe(dest(`./build/${env}`))
        await metaFiles(env)()
        Promise.resolve()
    }
}

// Handles env args
async function buildEntry() {
    const envArg = process.argv.find(e => e.startsWith("--env"))

    const buildSingle = async (env) => {
        const envCfg = environments.find(e => e.name === env)
        if (!envCfg) {
            return Promise.reject(new Error(`Unknown environment ${env} is not defined in deta.json!`))
        }
        console.log(`Starting build for env: ${env}`);
        await prepareBuild(env)()
        await build(env)()
        return Promise.resolve()
    }

    if (envArg) {
        const env = envArg.split("=")[1]
        return await buildSingle(env)
    }
    else {
        for (let i in environments) {
            let env = environments[i]
            await buildSingle(env.name)
        }
    }
}

function detaSetup(env) {
    return async function detaSetup() {
        console.log(`setupMicro() | ENV: ${env}`);
        const envCfg = environments.find(e => e.name === env)
        if (!envCfg) {
            return Promise.reject(new Error(`Unknown environment ${env} is not defined in deta.json!`))
        }
        if (!fs.existsSync(`./build/${env}`)) {
            return Promise.reject(`Cannot setup micro in missing directory ${env}! You probably want to build first!`)
        }
        if (!fs.existsSync(`./build/${env}/index.js`)) {
            return Promise.reject(`Cannot setup micro in directory missing index.js file: ${env}! You probably want to build first!`)
        }
        if (!fs.existsSync(`./build/${env}/.deta`)) {
            console.log("Creating new / Cloning existing micro... (This could take a while! Don't cancel the task!)");
            try {
                var { stdout, stderr } = await exec(`deta new --runtime nodejs12 --name ${micro_name}-${env} --project ${deta_project}`, {  // TODO! err try catches
                    cwd: `./build/${env}`,
                    shell: true
                });
                if (stdout) console.log(stdout);
                if (stderr) return Promise.reject(stderr)
            } catch (e) {
                if (e.stderr.includes("Program with such name already exists in the project")) {
                    // clear dir
                    await del([`./build/${env}/**`, `!${env}`], { force: true, dot: true })
                    // pull
                    var { stdout, stderr } = await exec(`deta clone --name ${micro_name}-${env} --project ${deta_project} ./${env}`, {
                        cwd: `./build/`,
                        shell: true
                    });
                    if (stdout) console.log(stdout);
                    if (stderr) return Promise.reject(stderr)
                    // rebuild
                    console.log("Rebuilding...");
                    await build(env)()
                }
            }
        }
        console.log(`Apply auth settings: ${envCfg.auth}...`);
        var { stdout, stderr } = await exec(`deta auth ${envCfg.auth ? 'enable' : 'disable'}`, {
            cwd: `./build/${env}`,
            shell: true
        });
        if (stdout) console.log(stdout)
        if (stderr) return Promise.reject(stderr)
        console.log("Applying .env...");
        var { stdout, stderr } = await exec("deta update -e .env", {
            cwd: `./build/${env}`,
        });
        if (stdout) console.log(stdout)
        if (stderr) return Promise.reject(stderr)
        Promise.resolve()
    }
}

function detaSetupEntry() {
    return async function detaSetupEntry() {
        for (let i in environments) {
            let e = environments[i]
            await detaSetup(e.name)()
        }
        Promise.resolve()
    }
}

function deploy(env) {
    return async function deploy() {
        console.log(`deploy() | ENV: ${env}`);
        try {
            const { stdout, stderr } = await exec("deta deploy", {
                cwd: `./build/${env}`,
            });
            if (stdout) console.log(stdout)
            if (stderr) console.log(stderr)
            return Promise.resolve()
        }
        catch (e) {
            return Promise.reject(e.stderr)
        }
    }
}

function deployEntry() {
    return async function deployEntry() {
        const envArg = process.argv.find(e => e.startsWith("--env"))

        const deploySingle = async (env) => {
            const envCfg = environments.find(e => e.name === env)
            if (!envCfg) {
                return Promise.reject(new Error(`Unknown environment ${env} is not defined in deta.json!`))
            }
            if (envCfg.confirmDeploy) {
                const res = await prompt(`Do you really want to deploy the ${env} environment?`)
                if (!res) return Promise.reject("Cancelled!")
                console.log(`Deploying env: ${env}...`);
                await deploy(env)()
            }
            else {
                console.log(`Deploying env: ${env}...`);
                await deploy(env)()
            }
            return Promise.resolve()
        }

        if (envArg) {
            const env = envArg.split("=")[1]
            return await deploySingle(env)
        }
        else {
            for (let i in environments) {
                let env = environments[i]
                await deploySingle(env.name)
            }
        }
    }
}

// Tasks
exports.build = buildEntry              // gulp build [--env=<env>]
exports.detaSetup = detaSetupEntry()    // gulp detaSetup
exports.deploy = deployEntry()          // gulp deploy [--env=<env>]