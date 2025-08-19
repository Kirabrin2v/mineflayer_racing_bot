class ModuleManager {
	constructor () {
		this.modules = {}

	}
	async load_modules(modules_info) {
		const load_promises = modules_info.map(async (module_info) => {
			const path = module_info[0]
			try {
				const parameters = module_info[1]
				const mod = require(path)
				//console.log("реквайр", mod)
				if (mod.initialize) {
					mod.initialize(parameters)
				}
				if (mod.structure) {
					CommandManager.modules_structure[mod.module_name] = mod.structure
					CommandManager.modules_structure[mod.module_name]._description = mod.help
				}
				this.modules[mod.module_name] = mod
				console.log(`${mod.module_name} успешно импортирован\n`)
			
			} catch (error) {
				console.log(`При импортировании модуля '${path}' возникла ошибка: ${error}`)
			}
		})
		await Promise.all(load_promises)
	}
	call_module(module_name, initiator) {
		const mod = this.modules[module_name]
		if (mod) {
			return new Proxy(mod, {
				get(target, prop) {
					const value = target[prop]

					if (typeof value === 'function') {
						return (...args) => {
							try {
								return value(...args)
							} catch (error) {
								actions_processing({
									type: "error",
									content: {
										date_time: new Date(),
										module_name: module_name,
										error: error,
										args: args,
										sender: initiator
									}
								})
								//console.error(`[${requester}] Ошибка при вызове ${prop} из модуля ${moduleName}:`, e)
							}
						}
					} else {
						return value // просто значение, если не функция
					}
				}
			})

		} else {
			console.log(`Модуля ${module_name} не существует`)
		}
		return new Proxy({}, {
			get(target, prop) {
				// Если кто-то попытается вызвать любую функцию на несуществующем модуле
				return (...args) => {
					console.warn(`[${initiator || "system"}] Попытка вызвать метод "${prop}" у незагруженного модуля "${module_name}" с аргументами:`, args)
					return undefined
				}
			}
		})
	}
}

module.exports = ModuleManager

