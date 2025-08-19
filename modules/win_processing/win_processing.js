const module_name = "win"

const fs = require('fs');
const path = require("path")

let actions = []

let wait_data = false;

let winners = JSON.parse(fs.readFileSync(path.join(__dirname,'winners.json'), 'utf8').toString())

function update_json() {
	fs.writeFileSync(path.join(__dirname,'winners.json'), JSON.stringify(winners, null, 2))
}


function accept_update_block(oldBlock, newBlock) {
	if (newBlock.metadata == 1) {
		if (wait_data) return;

		actions.push({
			type: "module_request",
			module_recipient: "ручуп",
			module_sender: module_name,
			content: {
				type: "request",
				cmd: "get",
				args: ["control_player"]
			}
		})
		wait_data = true;	
	}
}

function check_win(control_player) {
	const nickname = control_player.nick
	const start_time = control_player.start_time
	const now_time = new Date().getTime()
	if (winners.includes(nickname)) {
		actions.push({
			type: "answ",
			content: {
				recipient: nickname,
				message: "К сожалению, Вы не можете получить приз, т.к. Вы уже побеждали"
			}
		})
	} else {
		actions.push({
			type: "TCA",
			content: {
				nick: nickname, 
				amount: 1
			}
		})
		actions.push({
			type: "answ",
			content: {
				recipient: nickname,
				message: `Поздравляю с победой! Вы справились за ${(now_time - start_time)/1000}с!`
			}
		})
		winners.push(nickname)
	}
}

function module_dialogue(module_recipient, module_sender, json_cmd) {
	console.log("Зашло в module_dialogue win_processing.js", json_cmd.type, module_sender.module_name)
	if (json_cmd.type == "answ") {
		if (module_sender.module_name == "ручуп") {
			control_player = json_cmd.data.control_player
			if (control_player.nick) {
				check_win(control_player)
				wait_data = false;
				return {
					type: "module_request",
					module_sender: module_name,
					module_recipient: "ручуп",
					content: {
						type: "request",
						cmd: "clear_control_player"
					}
				}
			}
		}
	} else if (json_cmd.type == "request") {
		if (json_cmd.cmd == "get") {
			let data = {}
			const args = json_cmd.args
			if (args.includes("winners")) {
				data.winners = winners
			}
			return {
				type: "module_request",
				module_recipient: module_sender,
				module_sender: module_recipient,
				content: {
					type: "answ",
					data: data
				}
			}
		}
	}
}

function get_actions() {
	return actions.splice(0)
}

function diagnostic_eval (eval_expression) {
	try {
		return eval(eval_expression)
	} catch (error) {
		return error
	}
}

setInterval(update_json, 5000)

module.exports = {module_name, diagnostic_eval, get_actions, module_dialogue, accept_update_block}

