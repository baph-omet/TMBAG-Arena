/* * * * *
This JavaScript program was created entirely by me (all 1000+ lines of it!). The pixi.js script was provided by the PIXI.js team.
* * * * */

// create an new instance of a pixi stage
var stage = new PIXI.Stage(0x666666);
stage.interactive = true;

// create a renderer instance
var renderer = PIXI.autoDetectRenderer(1000, 500, {antialiasing: true});

// add the renderer view element to the DOM
document.getElementById("game").appendChild(renderer.view);

// Create global variables
var player,state,target,action,selectedSpecial,title,startText,output,waveCounter,waveStart,gameScene,titleScene,battleActions,preBattleText,targetSelectInstructionText,gameOverText,playerStatText,runAwayText;
var actionTexts = [];
var specialTexts = [];
var enemies = [];
var wave = 1;

// Set up the asset loader and load all sprites from the JSON hash file
var loader = new PIXI.AssetLoader(["images/sprites.json"]);
loader.onComplete = setup;
loader.load();

// Define the Actor class, a superclass for both Player and Enemy
function Actor() {
	// Set the object's sprite based on its name
	this.setSprite = function() {
		var self = this;
		this.spr = new PIXI.Sprite(PIXI.TextureCache[this.name.toLowerCase() + ".png"]);
		this.spr.interactive = true;
		this.spr.buttonMode = true;
		// Set up a click event on the sprite that if the player is in the target select mode, clicking on the sprite will return the actor as the target and change the state back to battle mode
		this.spr.click = this.spr.tap = function(data) {
			if(state == targetSelectMode){
				target = self;
				state = battle;
			}
			
		}
	}
	
	// How all actors attack
	this.attack = function(target) {
		// If the attack misses, otherwise...
		if (Math.random() > this.accuracy) {
			updateOutput(this.name + "'s attack missed!");
		} else {
			// Roll for a critical hit
			// Either way, damage is the difference of the caller's strength and the target's defense
			var damage;
			if (Math.random() < this.critChance) {
				updateOutput("Critical hit!");
				damage = this.strength * 3 - target.defense;
			} else {
				damage = this.strength - target.defense;
			}
			
			// If there is any damage at all
			if(damage > 0) {
				damage = Math.round(damage);
				updateOutput(this.name + " Attacked " + target.name + ", dealing " + damage + " damage!")
				target.health -= damage;
			} else {
				updateOutput(this.name + "'s attack failed to damage " + target.name);
			}
		}
	}
	
	// How all actors defend themselves
	this.defend = function() {
		if (!this.defending) {
			this.defense += this.strength;
			this.defending = true;
			updateOutput(this.name + " raised their guard! Defense is now " + this.defense);
		}
	}
	
	// Removes defending state from an actor
	this.unDefend = function() {
		if(this.defending) {
			this.defense -= this.strength;
			this.defending = false;
			updateOutput(this.name + " lowered their guard! Defense is now " + this.defense);
		}
	}
	
}

// Player class
function Player() {
	// Call to superclass
	Actor.call(this);
	
	// Player stats, mutable
	this.name = "PLAYER";
	this.level = 1;
	this.health = 10;
	this.maxHealth = 10;
	this.experience = 0;
	this.expNextLevel = 3;
	this.strength = 1;
	this.defense = 0;
	this.accuracy = 0.9;
	this.critChance = 0.05;
	this.sp = 3;
	this.maxSp = 3;
	this.specials = [];
	this.turn = true;
	
	this.setSprite();
	
	// How the player examines enemies
	this.examine = function(target) {
		updateOutput(player.name + " examined the enemy!");
		updateOutput(target.name + ": " + target.description);
		updateOutput("HP: " + target.health + "/" + target.maxHealth + " SP: " + target.sp + "/" + target.maxSp + " STR: " + target.strength + " DEF: " + target.defense + " ACC: " + Math.round(target.accuracy * 100) + "% CRIT: " + Math.round(target.critChance * 100) + "%");
	}
	
	// How the player runs away
	this.run = function() {
		state = runAway;
	}
	
	// How the player levels up
	this.levelUp = function() {
		// Roll EXP over to the next level
		this.experience = this.experience - this.expNextLevel;
		if(this.experience < 0) {
			this.experience = 0;
		}
		this.level += 1;
		updateOutput("-=-=- Level up! -=-=-")
		
		// Increase stats
		this.expNextLevel *= 2;
		this.critChance += 0.02;
		this.maxHealth += 3;
		this.health = this.maxHealth;
		this.maxSp += 1;
        this.sp = this.maxSp;
		if (this.level % 2 == 1){this.defense += 1;}
		else {this.strength += 1}
		updateOutput("LV: " + this.level + " STR: " + this.strength + " DEF: " + this.defense + " HP: " + this.maxHealth + " SP: " + this.maxSp + " CRIT: " + Math.round(this.critChance * 100) + "%");
		
		// Check to see if the player can learn any special attacks at this new level
		for (var special in specialAttacks) {
			if (specialAttacks[special].levelLearned == this.level) {
				this.specials.push(specialAttacks[special]);
				updateOutput("Learned Special Attack " + specialAttacks[special].name + "!");
			}
		}
		
		// Continue leveling up until the player doesn't have enough EXP
		if (this.experience > this.expNextLevel) {
			this.levelUp();
		}
	}
	
	// How players do special attacks
	this.specialAttack = function(special,target) {
		updateOutput(this.name + " used " + special.name + "!");
		this.sp -= special.cost;
		
		// How to execute the special attack based on what type of special it is
		switch (special.attackType) {
			case "single":
				// single specials are basically just powered-up attacks
				var strengthPlaceholder = this.strength;
				this.strength *= special.damageMultiplier;
				this.attack(target);
				this.strength = strengthPlaceholder;
				break;
			case "all":
				// "all" specials attack all enemies
				var strengthPlaceholder = this.strength;
				this.strength * special.damageMultiplier;
				for(var i=0;i<target.length;i++){
					this.attack(target[i]);
				}
				this.strength = strengthPlaceholder;
				break;
			case "self":
				// "self" specials heal the player
				var healing = Math.floor(this.maxHealth * special.healPercent / 100);
				// The player can't overheal themselves
				if(healing > (this.maxHealth - this.health)) {
					healing = this.maxHealth - this.health;
				}
				this.health += healing;
				updateOutput(player.name + " recovered " + healing + " HP!");
				break;
			case "sp":
				// "sp" specials drain SP from enemies (literally just a clone of PSI Magnet Omega from Earthbound)
				var totalDrained = 0;
				var strengthPlaceholder = this.strength;
				this.strength *= special.damageMultiplier;
				for(var i=0;i<target.length;i++){
					if(target[i].sp > 0) {
						var draining = Math.round(this.strength * (Math.random() + 0.5));
						if(draining > target[i].sp) {
							draining = target[i].sp;
						}
						updateOutput("Drained " + draining + " SP from " + target[i].name);
						totalDrained += draining
					}
				}
				this.sp += totalDrained;
				if(this.sp > this.maxSp) {
					this.sp = this.maxSp;
				}
				updateOutput("...for a total of " + totalDrained + " SP! " + this.name + "'s SP is now " + this.sp);
				this.strength = strengthPlaceholder;
				break;
		}
		
	}
	
	// A quick function to give the player EXP and check for levelup
	this.giveExp = function(amount) {
		this.experience += amount;
		if(this.experience >= this.expNextLevel) {
			this.levelUp();
		}
	}
	
}

// Enemy class, superclass for all enemy types
function Enemy() {
	Actor.call(this);
	
	// Enemies handle special attacks differently than the player
	this.specialAttack = function() {
		// Generate an array of usable specials
		var usableSpecials = [];
		for (var i=0;i < this.specials.length;i++){
			if(this.specials[i].attackType == "soulSplit") {
				if(this.sp < this.maxSp - 2) {
					usableSpecials.push(this.specials[i]);
				}
			}else if(this.specials[i].cost <= this.sp) {
				usableSpecials.push(this.specials[i]);
			}
		}
		//console.log(usableSpecials);
		// If the enemy can't use ANY of its specials
		if (usableSpecials.length == 0) {
			// Attack the player instead (probably out of frustration)
			this.attack(player);
		} else {
			// Otherwise, randomly pick a special attack from the ones it can use
			special = usableSpecials[Math.floor(Math.random() * (usableSpecials.length - 1))];
			updateOutput(this.name + " used " + special.name + "!");
			this.sp -= special.cost;
			// Disable critical hits until after the attack is finished
			var critChancePlaceholder = this.critChance;
			this.critChance = 0;
			switch (special.attackType) {
				case "player":
					var strengthPlaceholder = this.strength;
					this.strength *= special.damageMultiplier;
					this.attack(player);
					this.strength = strengthPlaceholder;
					break;
				case "self":
					var healing = Math.floor(this.maxHealth * special.healPercent / 100);
					this.health += healing;
					if(this.health > this.maxHealth) {
						this.health = this.maxHealth;
					}
					updateOutput(this.name + " recovered " + healing + " HP!");
					break;
				case "partyBuff":
					// Choose a random member of the enemy party (defaults to caster if they're all alone)
					var target = enemies[Math.floor(Math.random() * (enemies.length - 1))];
					target[special.buffStat] = Math.round(target[special.buffStat] * special.buffMultiplier);
					updateOutput(target.name + "'s " + special.buffStat + " is now " + target[special.buffStat] + "!");
					break;
				case "soulSplit":
					// Attacks self, damage dealt fills SP
					var damage = Math.round(this.strength * special.damageMultiplier);
					//console.log("damage is: " + damage);
					
					// Attack fails if it would kill the caster
					if (this.health <= damage) {
						updateOutput(this.name + " was too weak to split its soul!");
					} else {
						this.health -= damage;
						var spRestored = damage;
						if(spRestored > (this.maxSp - this.sp)) {
							spRestored = this.maxSp - this.sp;
						}
						this.sp += spRestored;
						updateOutput(this.name + " split its soul, taking " + damage + " damage and gaining " + spRestored + " SP");
					}
					break;
					
					
				// Enemy use of SP Magnet will be done later, if at all
				/*case "sp":
					var totalDrained = 0;
					var strengthPlaceholder = this.strength;
					this.strength *= special.damageMultiplier;
					for(var i=0;i<target.length;i++){
						if(target[i].sp > 0) {
							var draining = Math.round(this.strength * (Math.random() + 0.5));
							if(draining > target[i].sp) {
								draining = target[i].sp;
							}
							updateOutput("Drained " + draining + " SP from " + target[i].name);
							totalDrained += draining
						}
					}
					this.sp += totalDrained;
					if(this.sp > this.maxSp) {
						this.sp = this.maxSp;
					}
					updateOutput("...for a total of " + totalDrained + " SP! " + this.name + "'s SP is now " + this.sp);
					this.strength = strengthPlaceholder;
					break;*/
			}
			this.critChance = critChancePlaceholder;
		}
	}
	
	// How the enemy decides which behavior to execute (spoiler: it's random)
	this.chooseBehavior = function() {
		var choice = Math.random();
		var actionChoice;
		if (choice <= this.attackChance) {
			actionChoice = this.attack;
		} else if (choice <= this.attackChance + this.defendChance) {
			actionChoice = this.defend;
		} else {
			actionChoice = this.specialAttack;
		}
		return actionChoice;
	}
}

// Cloak enemy class
function Cloak() {
	// Call to superclass
	Enemy.call(this);
	
	// Stats
	this.name = "Cloak";
	this.description = "A scary ghost-like enemy that has taken the form of a hovering cloak. Spooky!";
	this.maxHealth = 3;
	this.health = this.maxHealth;
	this.maxSp = 3;
	this.sp = this.maxSp
	this.strength = 1;
	this.defense = 0;
	this.accuracy = 0.7;
	this.critChance = 0.01;
	this.expYield = 1;
	this.defending = false;
	
	// Specials
	this.specials = []
	
	// Behavior (must add up to 1.0)
	this.attackChance = 0.8;
	this.defendChance = 0.2;
	this.specialChance = 0.0;
	
	// Graphics settings
	this.setSprite();
}

// Eyeball enemy class
function Eyeball() {
	Enemy.call(this);
	
	this.name = "Eyeball";
	this.description = "A floating eyeball! Gross! It's twitching its optic nerve around menacingly.";
	this.maxHealth = 20;
	this.health = this.maxHealth;
	this.maxSp = 5;
	this.sp = this.maxSp;
	this.strength = 5;
	this.defense = 1;
	this.accuracy = 0.6;
	this.critChance = 0.09;
	this.expYield = 20;
	this.defending = false;
	
	this.specials = [
		enemySpecials.deathBlink,
		enemySpecials.regen,
		enemySpecials.soulSplit
	];
	
	this.attackChance = 0.5;
	this.defendChance = 0.1;
	this.specialChance = 0.4;
	
	this.setSprite();
}

// Phantom enemy class
function Phantom() {
	Enemy.call(this);
	
	this.name = "Phantom";
	this.description = "An angry-looking spirit, that exudes control over other spirits. It seems to be chanting something to itself.";
	this.maxHealth = 6;
	this.health = this.maxHealth;
	this.maxSp = 6;
	this.Sp = this.maxSp;
	this.strength = 3;
	this.defense = 1;
	this.accuracy = 0.81;
	this.critChance = 0.10;
	this.expYield = 5;
	this.defending = false;
	
	this.specials = [enemySpecials.incantation];
	
	this.attackChance = 0.3;
	this.defendChance = 0.2;
	this.specialChance = 0.5;
	
	this.setSprite();
}

// Dagger enemy class
function Dagger() {
	Enemy.call(this);
	
	this.name = "Dagger";
	this.description = "Similar to a Cloak, but contorted and deathly pale. Something sharp briefly flashes amidst its robes.";
	this.maxHealth = 5;
	this.health = this.maxHealth;
	this.maxSp = 3;
	this.sp = this.maxSp;
	this.strength = 5;
	this.defense = 0;
	this.accuracy = 0.77;
	this.critChance = 0.25;
	this.expYield = 5;
	this.defending = false;
	
	this.specials = [enemySpecials.flyingDagger];
	
	this.attackChance = 0.5;
	this.defendChance = 0;
	this.specialChance = 0.5;
	
	this.setSprite();
}

// Definition of all player specials
var specialAttacks = {
	heavyStrike: {
		name: "Heavy Strike",
		cost: 1,
		attackType: "single",
		damageMultiplier: 3,
		levelLearned: 2
	},
	healingTouch: {
		name: "Healing Touch",
		cost: 1,
		attackType: "self",
		healPercent: 50,
		levelLearned: 3
	},
	quickRush: {
		name: "Quick Rush",
		cost: 2,
		attackType: "all",
		damageMultiplier: 0.25,
		levelLearned: 4
	},
	spMagnet: {
		name: "SP Magnet",
		cost: 0,
		attackType: "sp",
		damageMultiplier: 1,
		levelLearned: 5
	}
}

// Definition of all enemy specials
var enemySpecials = {
	deathBlink: {
		name: "Death Blink",
		cost: 1,
		attackType: "player",
		damageMultiplier: 2.0
	},
	regen: {
		name: "Viscous Regeneration",
		cost: 2,
		attackType: "self",
		healPercent: 25
	},
	soulSplit: {
		name: "Soul Split",
		cost: 0,
		attackType: "soulSplit",
		damageMultiplier: 2.0
	},
	flyingDagger: {
		name: "Flying Dagger",
		cost: 3,
		attackType: "player",
		damageMultiplier: 2.0
	},
	incantation: {
		name: "Dark Incantation",
		cost: 2,
		attackType: "partyBuff",
		buffStat: "strength",
		buffMultiplier: 2.0
	}
}

// Setup all graphics elements
function setup() {
	var backdrop = new PIXI.Sprite(PIXI.TextureCache["dungeon.png"]);
	stage.addChild(backdrop);
	
	gameScene = new PIXI.DisplayObjectContainer();
	stage.addChild(gameScene);
	gameScene.visible = false;
	
	gameOverScene = new PIXI.DisplayObjectContainer();
	stage.addChild(gameOverScene);
	gameOverScene.visible = false;
	
	runAwayScene = new PIXI.DisplayObjectContainer();
	stage.addChild(runAwayScene);
	runAwayScene.visible = false;

	titleScene = new PIXI.DisplayObjectContainer();
	stage.addChild(titleScene);
	
	battleActions = new PIXI.DisplayObjectContainer();
	stage.addChild(battleActions);
	battleActions.visible = false;
	
	preBattleText = new PIXI.DisplayObjectContainer();
	stage.addChild(preBattleText);
	preBattleText.visible = false;
	
	specialTexts = new PIXI.DisplayObjectContainer();
	stage.addChild(specialTexts);
	specialTexts.visible = false;
	
	// Create Title
	title = new PIXI.Text("TMBAG Arena", {
			font: "50pt Impact, sans-serif",
			fill: 'white',
			dropShadow: true,
			dropShadowDistance:0
	});
	title.anchor.x = 0.5;
	title.anchor.y = 0.5;
	title.position.x = renderer.width / 2;
	title.position.y = 50;
	titleScene.addChild(title);
	
	// Create "Click to Start" text
	startText = new PIXI.Text("Click to start", {
		font: "20pt Impact, sans-serif",
		fill: 'white',
		dropShadow: true,
		dropShadowDistance:0
	});
	startText.anchor.x = 0.5;
	startText.anchor.y = 0.5;
	startText.position.x = renderer.width / 2;
	startText.position.y = 250;
	titleScene.addChild(startText);
	startText.interactive = true;
	
	
	
	// Create Player sprite
	player = new Player();
	player.spr.anchor.x = player.spr.anchor.y = 0.5;
	player.spr.position.x = 750;
	player.spr.position.y = 200;
	gameScene.addChild(player.spr);
	
	// Create player stats bar
	var playerStatsBar = new PIXI.Graphics();
	playerStatsBar.lineStyle(2,0xffffff,1);
	playerStatsBar.beginFill(0x0000a7);
	playerStatsBar.drawRoundedRect(650,10,200,85,10);
	playerStatsBar.endFill();
	gameScene.addChild(playerStatsBar);
	
	// Create player stat texts
	playerStatText = new PIXI.Text(player.name + "|Lv" + player.level + "       Wave: " + wave + "\nHP: " + player.health + "/" + player.maxHealth + " SP: " + player.sp + "/" + player.maxSp + "\nEXP: " + player.experience + "/" + player.expNextLevel + "\nSTR: " + player.strength + " DEF: " + player.defense + " CRIT: " + Math.round(player.critChance * 100) + "%", {
		font: "10pt monospace",
		fill: "white"
	});
	playerStatText.position.x = 655;
	playerStatText.position.y = 15;
	gameScene.addChild(playerStatText);
	
	// Create Actions bar
	var actionsBar = new PIXI.Graphics();
	actionsBar.lineStyle(2,0xffffff,1);
	actionsBar.beginFill(0x0000a7);
	actionsBar.drawRoundedRect(650,250,200,200,10);
	actionsBar.endFill();
	gameScene.addChild(actionsBar);
	
	// Create Output log box
	var outputBox = new PIXI.Graphics();
	outputBox.lineStyle(2,0xffffff,1);
	outputBox.beginFill(0x0000a7);
	outputBox.drawRoundedRect(50,270,580,180,10);
	outputBox.endFill();
	gameScene.addChild(outputBox);
	
	// Create Output log text
	output = new PIXI.Text("-=Battle.log=-", {
		font: "14pt monospace",
		fill: "white"
	});
	output.position.x = 55;
	output.position.y = 275;
	gameScene.addChild(output);
	
	// Create Wave Counter Message
	waveCounter = new PIXI.Text("WAVE " + wave, {
		font: "50pt Impact, sans-serif",
		fill: 'white',
		dropShadow: true,
		dropShadowDistance:0
	});
	waveCounter.anchor.x = 0.5;
	waveCounter.anchor.y = 0.5;
	waveCounter.position.x = renderer.width / 2;
	waveCounter.position.y = 50;
	preBattleText.addChild(waveCounter);
	
	// Create Wave start button
	waveStart = new PIXI.Text("BEGIN", {
		font: "20pt Impact, sans-serif",
		fill: 'white',
		dropShadow: true,
		dropShadowDistance:0
	});
	waveStart.anchor.x = 0.5;
	waveStart.anchor.y = 0.5;
	waveStart.position.x = renderer.width / 2;
	waveStart.position.y = 100;
	preBattleText.addChild(waveStart);
	waveStart.interactive = true;
	waveStart.buttonMode = true;
	
	
	
	var actions = ["ATTACK","DEFEND","SPECIAL","EXAMINE","RUN"]
	
	for (var i=0;i < actions.length;i++){
		var txt = new PIXI.Text(actions[i], {
			font: "26pt monospace",
			fill: 'white'
		});
		txt.position.x = 675;
		txt.position.y = 255 + 40 * i;
		battleActions.addChild(txt);
		txt.interactive = true;
		txt.buttonMode = true;
		txt.click = txt.tap = function(data) {
			action = this.text;
			//console.log(action);
		}
		actionTexts.push(txt);
	}
	
	targetSelectInstructionText = new PIXI.Text("Select a target", {
		font: "14pt monospace",
		fill: 'white'
	});
	targetSelectInstructionText.position.x = 675;
	targetSelectInstructionText.position.y = 255;
	gameScene.addChild(targetSelectInstructionText);
	targetSelectInstructionText.visible = false;
	
	var specialSelectInstructionText = new PIXI.Text("Select a special",{
		font: "14pt monospace",
		fill: 'white'
	});
	specialSelectInstructionText.position.x = 675;
	specialSelectInstructionText.position.y = 255;
	specialTexts.addChild(specialSelectInstructionText);
	specialSelectInstructionText.visible = false;
	
	gameOverText = new PIXI.Text(player.name + " has died! Game Over!", {
		font: "20pt Impact",
		fill: "white",
		dropShadow: true,
		dropShadowDistance:0
	});
	gameOverText.anchor.x = gameOverText.anchor.y = 0.5
	gameOverText.position.x = renderer.width / 2;
	gameOverText.position.y = renderer.height / 2;
	gameOverScene.addChild(gameOverText);
	
	runAwayText = new PIXI.Text(player.name + " has fled! Game Over!", {
		font: "20pt Impact",
		fill: "white",
		dropShadow: true,
		dropShadowDistance:0
	});
	runAwayText.anchor.x = runAwayText.anchor.y = 0.5
	runAwayText.position.x = renderer.width / 2;
	runAwayText.position.y = renderer.height / 2;
	runAwayScene.addChild(runAwayText);
	
	
	
	// Register event listeners
	//// When the "Click to Start" text is clicked
	startText.click = startText.tap = function(data) {
		state = preBattle;
	}
	
	//// When the Begin wave button is clicked
	waveStart.click = waveStart.tap = function(data) {
		state = battle;
	}
	
	state = titleScreen;
	gameLoop();
}

// Main game loop, repeats 60 times per second, calls whichever state the game is in
function gameLoop() {

	requestAnimFrame( gameLoop );
	
	state();

	// render the stage   
	renderer.render(stage);
}

// Title screen state, shows the title and that's about it
function titleScreen() {
	titleScene.visible = true;
	preBattleText.visible = false;
	battleActions.visible = false;
}

// pre-battle state, shows the wave counter, sets up enemies for the next wave, resets battle variables
function preBattle() {
	titleScene.visible = false;
	gameScene.visible = true;
	preBattleText.visible = true;
	battleActions.visible = false;
	action = "";
	player.turn = true;
	if (waveCounter.text.split()[1] != wave) {
		waveCounter.setText("WAVE " + wave);
	}
	if (enemies.length == 0) {
		enemies = wavePopulation(wave);
	}
}

// battle state, handles player and enemy turns
function battle() {
	// show all battle-relevant graphics
	targetSelectInstructionText.visible = false;
	specialTexts.visible = false;
	preBattleText.visible = false;
	battleActions.visible = true;
    	playerStatText.setText(player.name + "|Lv" + player.level + "       Wave: " + wave + "\nHP: " + player.health + "/" + player.maxHealth + " SP: " + player.sp + "/" + player.maxSp + "\nEXP: " + player.experience + "/" + player.expNextLevel + "\nSTR: " + player.strength + " DEF: " + player.defense + " CRIT: " + Math.round(player.critChance * 100) + "%");
	
	// If there are no more enemies, end the wave
	if (enemies.length == 0) {
		updateOutput("All enemies defeated! Wave " + wave + " defeated!");
		
		// If the player finished the wave with full health, give them a small EXP bonus
		if(player.health == player.maxHealth) {
			updateOutput("Perfect wave! +3 EXP");
			player.giveExp(3);
		}
		updateOutput("======================")
		wave++;
		state = preBattle;
		return;
	}
	
	// If the player is dead, switch to game over state
	if (player.health <= 0) {
		state = gameOver;
		return;
	}
	
	// If it is not the player's turn
	if (!player.turn) {
		action = "";
		// Each enemy chooses their behavior, then acts
		for(var i=0;i<enemies.length;i++) {
			enemies[i].unDefend();
			var behavior = enemies[i].chooseBehavior();
			switch (behavior) {
				case enemies[i].attack:
					enemies[i].attack(player);
					break;
				case enemies[i].defend:
					enemies[i].defend();
					break;
				case enemies[i].specialAttack:
					enemies[i].specialAttack()
					break;
			}
		}
		player.unDefend();
		updateOutput("----------------------")
		player.turn = true;
	}
	
	// If it is the player's turn
	if (player.turn && action) {
		// If the player has a target selected
		if (target) {
			// Execute an action
			switch (action) {
				case "ATTACK":
					player.attack(target);
					break;
				case "EXAMINE":
					player.examine(target);
					break;
				case "SPECIAL":
					player.specialAttack(selectedSpecial,target);
					selectedSpecial = null;
					break;
			}
			action = "";
			target = null;
			player.turn = false;
		} else if (selectedSpecial) {
			// If the player does not have a target, but has selected a special attack,
			// Handle target selection for special attacks
			switch (selectedSpecial.attackType) {
				case "single":
					targetSelect(enemies);
					break;
				case "all":
					target = enemies;
					break;
				case "self":
					target = player;
					break;
				case "sp":
					target = enemies;
					break;
			}
		} else {
			//Otherwise, determine which action the player wants to do
			switch (action) {
				case "EXAMINE":
				case "ATTACK":
					targetSelect(enemies);
					break;
				case "DEFEND":
					// if the player chooses to defend, no target selection is necessary
					player.defend();
					player.turn = false;
					break;
				case "SPECIAL":
					selectedSpecial = null;
					// load up the player's specials with clickable text, 
					// then send them into the special attack selection mode
					if (player.specials.length > 0) {
						if(player.sp >= 1) {
							for(var i=0; i<player.specials.length;i++){
								var txt = new PIXI.Text(player.specials[i].name, {
									font: "14pt monospace",
									fill: 'white'
								});
								txt.position.x = 675;
								txt.position.y = 255 + 40 * i;
								battleActions.addChild(txt);
								txt.interactive = true;
								txt.buttonMode = true;
								txt.click = txt.tap = function(data) {
									var j=0;
									var found = false;
									while(!found && j<player.specials.length) {
										if(this.text == player.specials[j].name) {
											found = true;
											if(player.sp >= player.specials[j].cost){
												selectedSpecial = player.specials[j];
											} else {
												updateOutput(player.name + " doesn't have enough SP for this attack!");
											}
										} else {
											j++;
										}
									}
									//console.log(action);
								}
								specialTexts.addChild(txt)
								state = specialSelectMode;
							}
						} else {
							updateOutput(player.name + " doesn't have enough SP for a special attack!");
							action = "";
						}
					} else {
						// However if the player has no special attacks, 
						// let them choose something else instead
						updateOutput(player.name + " has no special attacks!");
						action = "";
					}
					break;
				case "RUN":
					player.run();
					break;
			}
		}
		removeDeadEnemies(enemies);
	}	
}

// target select state, basically just tells the player to pick a target, then does nothing until they pick one
function targetSelectMode() {
	battleActions.visible = false;
	targetSelectInstructionText.visible = true;
	if (target != null) {
		state = battle;
	}
}

// same as targetSelectMode, but the player picks one of their special moves instead
function specialSelectMode() {
	battleActions.visible = false;
	specialTexts.visible = true;
	if (selectedSpecial) {
		state = battle;
	}
}

// If the player has died, show them the number of waves they have cleared
function gameOver() {
	gameScene.visible = false;
	battleActions.visible = false;
	gameOverScene.visible = true;
	gameOverText.setText(player.name + " has died! Game Over!\nWaves cleared: " + (wave - 1));
}

// Same as gameOver, but with different text
function runAway() {
	gameScene.visible = false;
	battleActions.visible = false;
	runAwayScene.visible = true;
	runAwayText.setText(player.name + " has fled! Game Over!\nWaves cleared: " + (wave - 1));
}

// A function to create enemy objects and position their sprites
// syntax: createEnemies([Enemy1,Enemy2,...,Enemy5]) -> array of enemies
// Any enemies past index 4 are ignored
function createEnemies(types) {
	var enms = [];
	for(var i = 0; i<types.length && i<5; i++) {
		var enemy = new types[i];
		enemy.spr.anchor.x = enemy.spr.anchor.y = 0.5;
		enemy.spr.position.x = 450 - 100 * i;
		enemy.spr.position.y = Math.floor((Math.random() * 40) - 20) + 200;
		enms.push(enemy);
		gameScene.addChild(enemy.spr);
	}
	return enms;
}

// How the game decides which enemies are spawned in each wave
function wavePopulation(wave) {
	var enemies;
	switch (wave) {
		// For wave 1-5, the player fights a number of Cloaks that equals the wave integer divided by 2
		case 1:
		case 2:
		case 3:
		case 4:
		case 5:
			var ens = [];
			var amount = Math.trunc((wave + 1)/2);
			for(var i=0;i<amount;i++) {
				ens.push(Cloak);
			}
			enemies = createEnemies(ens);
			break;
		// Wave 6 and beyond have custom enemy numbers
		// Wave 6 is a boss wave
		case 6:
			enemies = createEnemies([Cloak,Cloak,Eyeball]);
			break;
		case 7:
			enemies = createEnemies([Cloak,Phantom,Dagger]);
			break;
		case 8:
			enemies = createEnemies([Phantom,Phantom,Dagger]);
			break;
		case 9:
			enemies = createEnemies([Cloak,Cloak,Cloak,Phantom,Phantom]);
			break;
		case 10:
			enemies = createEnemies([Dagger,Dagger,Phantom,Phantom,Phantom]);
			break;
		case 11:
			enemies = createEnemies([Dagger,Dagger,Dagger,Phantom,Phantom]);
			break;
		// Wave 12 is a boss round
		case 12:
			enemies = createEnemies([Eyeball,Phantom,Phantom]);
			break;
		// Wave 13 is a Hell round
		case 13:
			enemies = createEnemies([Eyeball,Eyeball,Phantom,Phantom]);
			break;
	}
	return enemies;
}

// Pushes text to the battle log
function updateOutput(newText) {
	// waits for a sec
	sleep(750);
	// tries to break the text to a new line if it's too long
	if (newText.length > 55) {
		var found = false;
		for(var i=50;i<56;i++) {
			if(newText[i] == " ") {
				newText = newText.substr(0,i) + "\n    " + newText.substr(i+1,newText.length - 1);
				found = true;
				break;
			}
		} if (!found) {
			newText = newText.substr(0,54) + "-\n    " + newText.substr(54,newText.length - 1);
		}
	}
	output.setText(output.text + "\n" + newText);
	// Pushes the oldest line out of the log
	var lines = output.text.split("\n");
	while (lines.length > 7) {
		lines.splice(0,1);
	}
	output.text = lines.join("\n");
	console.log(newText);
}

// Handles target selection, sends the player to the target select mode if # of enemies  > 1
function targetSelect(enemies) {
	if (enemies.length == 1) {
		target = enemies[0];
	} else {
		target = null;
		state = targetSelectMode;
	}
}

// Checks for dead enemies and removes them
function removeDeadEnemies(enemies) {
	var i = 0;
	while(i<enemies.length) {
		if (!enemies) {
			break;
		}
		if (enemies[i].health <= 0) {
			updateOutput(enemies[i].name + " was defeated! " + player.name + " gained " + enemies[i].expYield + " EXP!");
			player.experience += enemies[i].expYield;
			if (player.experience >= player.expNextLevel) {
				player.levelUp();
			}
			gameScene.removeChild(enemies[i].spr);
			enemies.splice(i,1);
		} else {
			i++;
		}
	}
}

// Sleeps the game for a split second
function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}
