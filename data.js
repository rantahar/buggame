/* Static game data. Includes all structures, upgrades, bug types and resource types */

/* Define resource types */
 /* The gathering variables essentially refer to the number of standard bugs
  * in each task. Since they actually vary in efficiency, this is not an integer.
  * Consuming is similar, measures bugs consumption in units of starting bugs
  */

/* Initial resources when not modified at launch */
var initial_resources =  {
  water: {
    amount: 10, gathering: 0, consuming: 0,
    storage: 100.001, gatherable: true,
  },
  food: {
    amount: 40, gathering: 0, consuming: 0,
    storage: 100.001, gatherable: false,
  },
  oil: {
    amount: 0, gathering: 0, consuming: 0,
    storage: 0.001, gatherable: false,
  },
  steel: {
    amount: 0, gathering: 0, consuming: 0,
    storage: 0.001, gatherable: false,
  },
};

/* The initial list of perks */
function Perklist(){
  this.lander = {}
  this.lander.egginterval = 1;
  this.lander.carrying = 1;
  this.lander.foodspeed = 1;
  this.lander.consumption = 1;
  this.lander.max_age = 200;

  this.initial_resources = JSON.parse(JSON.stringify(initial_resources));
}


var landerperks = {
  egginterval:{
    title: "Egg Production",
    description: "The speed eggs are produced. Faster is usually better, but leaders will also spend resources on the eggs."
  },
  carrying:{
    title: "Carrying",
    description: "The amount of water or food a bug can carry or push."
  },
  foodspeed:{
    title: "Food Collecting",
    description: "Worker bugs ability to find and collect food. Multiplies food production."
  },
  consumption:{
    title: "Metabolism",
    description: "The efficiency of a bugs metabolism. The larger this is, the less the bugs will waste."
  },
  max_age:{
    title: "Age Limit",
    description: "How long your bugs live before they need to be replaced. Saves on eggs."
  },
  farm_efficiency: {
    title: "Farm Efficiency",
    description: "The growth speed of your moss."
  },
  diggerspeed:{
    title: "Digging",
    description: "The efficiency of the digger bugs mandibles."
  },
  soldierspeed:{
    title: "Guarding",
    description: "Your soldiers tactics efficiency in guarding workers."
  }
}

/* Initial resources for next run */
function get_initial_resources(){
  return engine.perks.initial_resources;
}

function custom_setup(){
  engine.state.planet = 'primitive';
}


/* Check if out of food or water, return work speed penalty */
function check_out_of_resource(){
  if( check_out_of_resource.outof == undefined )
    check_out_of_resource.outof= { food: false, water: false };
  var penalty = 1;

  for( let key in check_out_of_resource.outof ){
    if( engine.resources[key].amount <= 0){
      if( check_out_of_resource.outof[key] == false ){
        check_out_of_resource.outof[key] = true;
      }
      penalty *= 0.2;
    } else {
      check_out_of_resource.outof[key] = false;
    }
  }

  return penalty;
}


/* Calculate the consumption of a resource */
function get_consumption(key) {
  let consuming = engine.resources[key].consuming;
  if( key == 'water' || key == 'food' ){
    consuming /= engine.perks.lander.consumption;
    if( engine.counter('Nqueens') > 0 ){
      /* This is because queens take over the job of producing eggs,
       * removing the need for others to carry egg sacks. Also
       * affects higher tier bugs, they don't need eggsacks either...
       */
      consuming *= 0.8;
    }
  }
  return check_out_of_resource()*consuming;
}

/* Calculate the amount of resource gathered */
function get_gathering(key) {
  let gathering = engine.resources[key].gathering;
  gathering *= engine.perks.lander.carrying;
  if( key == 'water' ){
    /* Occupy the pumps  */
    pumping = Math.min(1000*engine.counter('waterpumps'),gathering);
    gathering = planets[engine.state.planet].water_gather( gathering );
    if( engine.state.unlocks.automated_pumps=='unlocked' ){
      pumping *= 100;
    }
    gathering += pumping;
  }
  if( key == 'food' ){
    gathering *= engine.perks.lander.foodspeed;
    /* First fill farms */
    farming = Math.min(1000*engine.counter('farms'),gathering);
    farming += Math.min(1*engine.counter('microfarms'),gathering);
    gathering -= farming;
    if( engine.state.unlocks.automated_farms == 'unlocked' ){
      farming *= 100;
    }
    if(engine.next_perks.lander.farm_efficiency)
      farming *= engine.next_perks.lander.farm_efficiency
    
    /* Food gathering speed depends on the planet */
    gathering = planets[engine.state.planet].food_gather( gathering );
    gathering = farming + gathering;
  }
  return check_out_of_resource()*gathering;
}

function get_resource_persec(key){
  return get_gathering(key)-get_consumption(key);
}


/* Get the starting bug configuration */
function get_startbugs(){
  var bugs = [new Worker()];
  bugs[0].name = 'Lander';
  return bugs;
}

function get_max_age(){
  return engine.perks.lander.max_age;
}

/* Planets the colony can live in */
var planets = {
  /* A lifeless rocky planet with water */
  lifeless: {
    description: "A planet with no life whatsoever. Completely safe, but has no food.",
    water_gather: function ( gather ) { return( gather/2.0 ); },
    food_gather: function ( gather ) { return( 0 ); },
    danger: function ( population, soldiers ) { 
      if(population > 100){
        return 0.001; 
      } else {
        return 0;
      }
    },  
  },
  /* The starting point */
  primitive: {
    description: "A planet with only primitive life. There is something to eat, but it collecting it can be trouble.",
    water_gather: function ( gather ) { return( gather ); },
    food_gather: function ( gather ) {
      return ( Math.log(1+gather/5000)*5000 );
    },
    danger: function ( population, soldiers ) { 
      if(population > 100){
        return 0.001; 
      } else {
        return 0;
      }
    },  
  },
  /* A planet with complex life */
  complex: {
    description: "A planet with complex life, some of which will move around on it's own. They will eat you if they can.",
    water_gather: function ( gather ) { return( gather ); },
    food_gather: function ( gather ) {
      return ( Math.log(1+gather/50000)*50000 );
    },
    danger: function ( population, soldiers ) {
      let n = population - 1 - 2*soldiers;
      if( n<1 )
        n=1;
      return( 3*n/(n+20) );
    },
  },
  /* A planet with intelligent life */
  intelligent: {
    description: "A planet with intelligent life. Dangerous.",
    water_gather: function ( gather ) { return( gather ); },
    food_gather: function ( gather ) {
      return ( Math.log(1+gather/500000)*500000 );
    },
    danger: function ( population, soldiers ) {
      let n = population - 1 - soldiers;
      if( n<1 )
        n=1;
      return( 10*n/(n+50) );
    },
  },
}


function dangerlevel(){
  let w = engine.counter('Nworkers');
  let s = engine.counter('Nsoldiers');
  if(engine.perks.lander.soldierspeed){
    s *= engine.perks.lander.soldierspeed;
  }
  if(engine.perks.lander.diggerspeed){
    s *= engine.perks.lander.diggerspeed;
  }
  return planets[engine.state.planet].danger( w, s );
}


/* Counters to display with resources */
var display_count = [ 'workers', 'diggers', 'soldiers' ];


/* Variables and functions related to the bug objects */

/* A list of buggy names */
var names = [ 'Buggy', 'Bob', 'Bobby', 'Wormy', 'Green', 'Hairy', 'Tingly', 'Slimy', 'Nibly', 'Spiky', 'Bubly', 'Ambersand', 'Stingy', 'Stinger', 'Globule', 'Blob', 'Blobber', 'Anty', 'Beebee', 'Pod', 'Poddy', 'Wingless', 'Leggy', 'Longlegs' ];


/* Bug classes */

/* Tier 0 */
/*
 * A basic worker. Gathers food and water
 */
var Worker = function Worker () {
  engine.Bug.call(this);
  this.name = names[Math.floor(Math.random() * names.length)];
  this.type = 'worker';
};

/*
 * A nurser, a standard leader that generates workers
 */
var Nurser = function Nurser (tier) {
  engine.Leader.call(this);
  this.name = names[Math.floor(Math.random() * names.length)];
  this.type  = 'nurser';
};

/* Tier 1 bugs */
/*
 * A standard group with nursers and workers
 */
var Workergroup = function Workergroup( tier ){
  engine.Group.call(this);
  this.name = names[Math.floor(Math.random() * names.length)];
  this.type = 'workergroup';

  var n_members = calc_group_numbers(tier);
  var nurses = n_members.n;
  var workers = n_members.w;
  this.gatherspeed = {food: workers, water: workers};
  var age_penalty = 11/engine.perks.lander.max_age;
  this.consumption = {
    food:  (0.2+age_penalty)*(workers+nurses),
    water: (0.2+age_penalty)*(workers+nurses)
  };
  this.count = {
    worker: workers
  };
  this.hatched = false;
  this.age=0;
};

var Emptygroup = function Emptygroup( tier ){
  Workergroup.call(this, tier);
  this.bugs = [ new Nurser( tier-1 ), ];
  this.hatched = undefined;
  this.age=undefined;
};


/***
 * This section contains constructors for bug types. They should
 * not have methods, since existing bugs are serialised and saved.
 * Methods should be added to the items data structure below.
 ***/
/*
 * A digger group leader
 */
var Leaddigger = function Leaddigger( tier ){
  engine.Leader.call(this);
  this.type  = 'leaddigger';
  this.name = names[Math.floor(Math.random() * names.length)];
};

/*
 * A standard digger
 */
var Digger = function Digger( tier ){
  engine.Bug.call(this);
  this.name = names[Math.floor(Math.random() * names.length)];
  this.type  = 'digger';
};

/*
 * A soldier group leader
 */
var Leadsoldier = function Leadsoldier( tier ){
  engine.Leader.call(this);
  this.type  = 'leadsoldier';
  this.name = names[Math.floor(Math.random() * names.length)];
};

/*
 * A soldier
 */
var Soldier = function Soldier( tier ){
  engine.Bug.call(this);
  this.name = names[Math.floor(Math.random() * names.length)];
  this.type  = 'soldier';
};

/*
 * A group of diggers
 */
var Diggergroup = function Diggergroup( tier ){
  engine.Group.call(this);
  this.type = 'diggergroup';
  this.name = names[Math.floor(Math.random() * names.length)];

  var n_members = calc_group_numbers(tier);
  var nurses = n_members.n;
  var workers = n_members.w;
  this.gatherspeed = {};
  var age_penalty = 10/engine.perks.lander.max_age;
  this.consumption = {
    food:  (1+8*age_penalty)*workers+(0.2+5*age_penalty)*nurses,
    water: (1+8*age_penalty)*workers+(0.2+5*age_penalty)*nurses
  };
  this.count = {
    digger: workers
  };
  this.hatched = false;
  this.age=0;
};


/*
 * A group of soldiers
 */
var Soldiergroup = function Soldiergroup( tier ){
  engine.Group.call(this);
  this.type = 'soldiergroup';
  this.name = names[Math.floor(Math.random() * names.length)];
  
  var n_members = calc_group_numbers(tier);
  var nurses = n_members.n;
  var workers = n_members.w;
  this.gatherspeed = {};
  var age_penalty = 20/engine.perks.lander.max_age;
  this.consumption = {
    food:  (5+age_penalty)*(workers+nurses),
    water: (5+age_penalty)*(workers+nurses)
  };
  this.count = {
    soldier: workers
  };
  this.hatched = false;
  this.age=0;
};

/*
 * Implemented as a bug, produces oil
 */
var Oilcluster = function Oilcluster( tier ){
  engine.Bug.call(this);
  this.age = undefined;
  this.hatched = false;
  this.name = names[Math.floor(Math.random() * names.length)];
  this.type  = 'oilcluster';
  this.gather = 'oil';
};

/*
 * Implemented as a bug, produces steel
 */
var Steelcluster = function Steelcluster( tier ){
  engine.Bug.call(this);
  this.age = undefined;
  this.hatched = false;
  this.name = names[Math.floor(Math.random() * names.length)];
  this.type  = 'steelcluster';
  this.gather = 'steel';
};

/*
 * Creates lander egs
 */
var Grandqueen = function Digger( tier ){
  engine.Bug.call(this);
  this.name = names[Math.floor(Math.random() * names.length)];
  this.type  = 'grandqueen';
};


/*
 * Calculate the number of nursers and workers in a group
 */
function calc_group_numbers( tier ){
  // Calculate the numbe of units in a group
  var workers = Math.pow( 7, tier );
  var nursers = 0;
  for( var i = 0; i < tier; i++){
    nursers += Math.pow( 7, i );
  }
  return {n: nursers, w:workers};
}


/* Get the color of a group */
function group_color( bug ){
  var sum = {green: 0, blue:0, black:0, red:0};
  for( var i=1; i<bug.bugs.length; i++ ){
    var color;
    if( bug.group ){
      color = group_color(bug.bugs[i]);
    } else {
      color = items[bug.bugs[i].type].color;
    }
    sum[color]+=1;
  }
  if( sum.blue > sum.green ){
    return 'blue';
  } else {
    return 'green';
  }
}


/* Calculate current buildspeed. Required to update build queue */
function buildspeed(){
  let buildspeed = 0.001*engine.counter('Nworkers');
  let diggerspeed = 1;
  if( engine.perks.lander.diggerspeed )
    diggerspeed = engine.perks.lander.diggerspeed;
  buildspeed += diggerspeed*engine.counter('Ndiggers');
  return check_out_of_resource()*buildspeed;
}



/***
 * Unlockable items and story events
 * There are three basic types: 
 * upgrade: 
 *     Upgrades can be bought once and usually have an immediate
 *     effect on the game
 * structure: 
 *     Stuctures Take time to build and usually have a lasting effect
 *     until the end of the current run
 *     Unique structure is a special type of structure that can only
 *     be built once
 * bug: 
 *     Bugs do all the work. Only 8 can exist at each tier
 * special:
 *     Story events mostly, but can also modify data based on triggers
 ***/
var items = {
  /* Start with a couple of special events */
  landing: {
    type: 'special',
    unlockmessage: "You float down in a soft white egg shell. A safe landing.",
    unlockcondition: function () {
			return ( true );
		}
  },
  firsthatch: {
    type: 'special',
    unlockmessage: "As you break the shell, you take in the sunlight of your world. The sky is blue. White clouds drift acros a valley. You hear the sound of water in the distance. You are one of the lucky ones.",
    unlockcondition: function () {
			return ( engine.bugs[0] && engine.bugs[0].hatched );
		}
  },
  gogetwater: {
    type: 'special',
    unlockmessage: "Well, time to go get some of that water.",
    unlockcondition: function () {
      return ( engine.bugs[0] && engine.bugs[0].age > 10 ||
               engine.resources.water.gathering > 0 );
		}
  },
  outoffood: {
    type: 'special',
    onunlock: function() {
      display.story("You have run out of food!");
    },
    unlockcondition: function () {
      return ( engine.resources.food.amount < 0.0001 );
    }
  },
  outofwater: {
    type: 'special',
    onunlock: function() {
      display.story("You have run out of water!");
    },
    unlockcondition: function () {
      return ( engine.resources.water.amount < 0.0001 );
    }
  },
  outofresource: {
    type: 'special',
    onunlock: function() {
      display.story("Your bugs will spend most of their time getting their own.");
      display.story("They will work a lot slower.");
    },
    unlockcondition: function () {
      return ( engine.resources.food.amount < 0.0001 || engine.resources.water.amount < 0.0001 );
    }
  },

  abovestoragefood: {
    type: 'special',
    onunlock: function() {
      display.story("Since you gather more food per second than you can store, just piling on the ground seems like a sensible thing again. You can use the it immediately.");
    },
    unlockcondition: function () {
      var persec = get_resource_persec('food');
      return ( engine.resources.food.storage < persec );
    }
  },

  abovestoragewater: {
    type: 'special',
    onunlock: function() {
      display.story("Since you can get all the water you can store in a second, you don't really need to store it.");
    },
    unlockcondition: function () {
      var persec = get_resource_persec('water');
      return ( engine.resources.water.storage < persec );
    }
  },

  /* You start by making workers */
  worker: {
    type: 'bug',
    title: 'Worker',
    description: 'Standard worker bug',
    unlockmessage: "The lifetime of the lander is limited. Make some more workers.",
    price: { food:10, water: 10 },
    get available() { return engine.tier == 0 },
    bugclass: Worker,
    unlockcondition: function () {
        return ( engine.resources.water.amount > 10 );
    },
    cangather: {food: 'select', water: 'select'},
    gatherspeed: {food: 1, water: 1},
    consumption: {food: 0.2, water: 0.2},
    bug: true,
    color: 'green',
  },

  firstegg: {
    type: 'special',
    unlockmessage: "The egg is small and crumbled, but there are no predators, so it should be fine.",
    unlockcondition: function () {
			return ( engine.bugs.length > 1 );
		}
  },

  killbug: {
    type: 'special',
    unlockmessage: "Sometimes it's necessary to let a bug go to make room for an important addition. You'd rather not do it. They tend to just wander around for a while and die.",
    unlockcondition: function () {
			return ( engine.bugs.length > 7 );
		}
  },

  /* Food should be unlocked early on */
  food_primitive: {
    type: 'special',
    onunlock: function() {
      engine.resources.food.gatherable = true;
    },
    unlockmessage: "There's a green moss growing on the wet rocks by the river. You can gather that for food.",
    unlockcondition: function () {
      return ( engine.state.planet == "primitive" &&  
               engine.resources.water.gathering > 0.1 && engine.bugs[0].age > 10 );
    }
  },
  food_lifeless: {
    type: 'special',
    onunlock: function() {
      engine.resources.food.gatherable = true;
    },
    unlockmessage: "You feel a terrible sense of dread. You need more food. Nothing grows here. You need a farm.",
    unlockcondition: function () {
      return ( engine.state.planet == "lifeless" &&
      engine.bugs[0] && engine.bugs[0].age > 7 );
    }
  },
  food_complex: {
    type: 'special',
    onunlock: function() {
      engine.resources.food.gatherable = true;
    },
    unlockmessage: "Edible things abound. Plants reach the skies and their roots dig deep into the ground. Food won't be a problem, unless your bugs get eaten first.",
    unlockcondition: function () {
      return ( engine.state.planet == "complex"&& ( engine.bugs.length > 1 && engine.bugs[0].age > 7 ));
    }
  },
  food_intelligent: {
    type: 'special',
    onunlock: function() {
      engine.resources.food.gatherable = true;
    },
    unlockmessage: "There is life everywhere, in many different forms. Most of it moves on it's own. Basically everything will try to eat you.",
    unlockcondition: function () {
      return ( engine.state.planet == "intelligent" && ( engine.bugs.length > 1 && engine.bugs[0].age > 7 ));
    }
  },

  /* Low level storage structures for food and water */
  foodcavern: {
    type: 'structure',
    title: 'Food Cavern',
    description: 'Dig a cavern to store some food in the cold.',
    unlockmessage: "There's only so much food you can keep good by piling on the ground.",
    get price() { return {
      food:  10*engine.buynumber,
      water: 20*engine.buynumber };
    },
    get available() { return engine.tier == 0 },
    buildtime: 0.02,
    oncomplete: function(){
      engine.increase_counter('foodcaverns');
      engine.resources.food.storage += 50; },
    unlockcondition: function () {
        return ( engine.resources.food.amount > 40 );
    }
  },
  
  well: {
    type: 'structure',
    title: 'Well',
    description: 'Waterproof a tunnel with a cement made of dust and water.',
    unlockmessage: "You should make a waterproof hole to put the water in.",
    get price() { return {
      food:  20*engine.buynumber,
      water: 10*engine.buynumber };
    },
    get available() { return engine.tier == 0 },
    buildtime: 0.02,
    oncomplete: function(){
      engine.increase_counter('wells');
      engine.resources.water.storage += 50; },
    unlockcondition: function () {
        return ( engine.resources.water.amount > 30 );
    }
  },

  /* Each tier has a queen type */
  nurser: {
    type: 'bug',
    names: { 0: 'Nurser',
             1: 'Linker',
             2: 'Queen',
             3: 'Nerve',
             4: 'Queen of queens',
             5: 'Central Nerve',
             6: 'Empress',
             7: 'Messenger',
             8: 'Star',
             9: 'Transmitter',
    },
    defaultname: "Linker",
    get title()  {
          var title = this.names[engine.tier];
          if( title == undefined ) title = this.defaultname;
          return title;
    },
    descriptions: {
             0: "A nurser takes care of eggs and sends newly hatched bugs to work",
             1: "You can delegate the job of linking groups to this little bug. It just sits in the nest and talks with the nursers.",
             2: "At this point it's best to assign one bug to produce eggs. It's egg sack makes it immobile, but it can still manage the supergroups. ",
             3: "Controlling a huge nest requires speed. This little linker has two long antenna running in specialized long tunnels. Very efficient, but fragile.",
             4: "Basically a queen without the egg sack. A central point for the nerves.",
             5: "Nerves are very useful for long distance communication. These guys have longer, thicker antennae and can link over longer distances.",
             6: "In a huge central cavern, the empress whispers commands to the linkers",
             7: "A light emitting bug that can communicate long distances",
             8: "Powerfull little beacon bug with good vision",
             9: "Looks like a nerve, but the antennae produce long lightwaves that bounce back from the atmosphere"
    },
    defaultdescription: "Link your colonies using light emitting bugs.",
    get description()  {
      var title = this.descriptions[engine.tier];
      if( title == undefined ) title = this.defaultdescription;
      return title;
    },
    unlockmessage: "Automation is the key to growth. A dedicated nurser allows you to think about other things. It can also assign resource gathering to the workers.",
    tieredprice: function( tier ) {
      return { food: 3*Math.pow( 6, tier+1 ),
              water: 3*Math.pow( 6, tier+1 ) };
    },
    get price() { return this.tieredprice( engine.tier ); },
    consumption: {food: 0.2, water: 0.2},
    cansetgather: {food: true, water: true},
    bugclass: Nurser,
    unlockcondition: function () {
        return ( engine.resources.food.storage > 100 &&
                 engine.resources.food.amount > 40 );
    },
    get available(){
      if( engine.tier < 8 ){
        return true;
      } else if( engine.perks.longrangecommunication ){
        return true;
      }
      return false;
    },
    color: 'red',
    leader: true,
    groupclass: Workergroup,
    childtype: 'worker',
    grouptype: 'emptygroup',
    egginterval: function(tier){
      return 10*Math.pow( 4, tier )/engine.perks.lander.egginterval;
    },
    ondeath: function( gather, buglist, tier ){
      if( engine.state.unlocks.smartnurser=='unlocked' ){
        var success = engine.buybug( 'nurser', buglist, tier );
        if( success ){
          buglist[0].gather = gather;
          if( engine.state.unlocks.smartnurser == 'unlocked' )
              buglist[0].age = 5;
        }
      }
    }
  },

  firstnurser: {
    type: 'special',
    unlockmessage: "At first glance it looks like a slightly bigger egg. Nursers cannot gather food or water, but they will automatically produce more workers when there is space.",
    unlockcondition: function () {
      if( engine.bugs[0] ){
        return ( engine.bugs[0].type == 'nurser' );
      }
    }
  },

  detachment: {
    type: 'upgrade',
    title: 'Detachment',
    description: 'Detach from the group and give control to the nurser. Allows you to create more groups and expand.',
    unlockmessage: "Nursers are now smart enough to take care of the group.",
    get price() { return {}; },
    get available() { return (engine.toptier[0]!=undefined && engine.toptier[0].leader==true) },
    upgradeeffect: function() { 
      engine.detachment();
      engine.state.unlocks.detachment = true;
    },
    unlockcondition: function () {
      return  engine.state.unlocks.smartnurser == 'unlocked';
    }
  },
  firstdetachment: {
    type: 'special',
    unlockmessage: "Be carefull now. Remember to keep up your food and water stores for your nursers. You can click on the nurser to see it's group.",
    unlockcondition: function () {
      return ( engine.counter('Nworkers') > 7 );
    }
  },

  /* Some upgrades for the first tier */
  smartnurser: {
    type: 'upgrade',
    title: 'Smart Nursers',
    description: 'Give the nursers a few more brain cells so that they can prepare eggs in advance. New workers will be born ready to work and when the nurser dies, it will create a new one.',
    price: { food:100, water: 30 },
    upgradeeffect: function() { },
    unlockcondition: function () {
        return ( engine.bugs[0] && engine.bugs[0].type == 'nurser' 
            &&( engine.perks.launched || engine.bugs[0].age > 10 )  );
    }
  },


  /* Above tier 0 we have groups */
  emptygroup: {
    type: 'bug',
    names: { 0: 'Nurser',
             1: 'Linker',
             2: 'Queen',
             3: 'Nerve',
             4: 'Queen of queens',
             5: 'Nerve',
             6: 'Empress',
             7: 'Messenger',
             8: 'Star',
             9: 'Transmitter',
    },
    defaultname: "Linker",
    get title()  {
          var title = this.names[engine.tier-1];
          if( title == undefined ) title = this.defaultname;
          return title;
    },
    description: 'A leader for a new group',
    get price() {
      return { food: 3*Math.pow( 6, engine.tier ),
              water: 3*Math.pow( 6, engine.tier ) };
    },
    bugclass: Emptygroup,
    get available(){
      if( engine.tier > 0 ){
        if( engine.tier < 9 ){
          return true;
        } else if( engine.perks.longrangecommunication ){
          return true;
        }
      }
      return false;
    },
    unlockcondition: function () {
        return ( engine.tier > 0  );
    },
    group: true,
    color: 'green',
    leaderclass: Nurser,
    groupclass: Workergroup,
    memberclass: Worker,
    membertype: 'worker',
  },

  /* Tier 1 */
  digger: {
    type: 'bug',
    title: 'Digger',
    description: 'Make a large bug with strong mandibles for digging and moving dirt.',
    unlockmessage: "Diggers are important for a blooming colony. They build structures quickly, but they eat a lot and don't gather food or water. Make sure you can feed them.",
    price: { food: 80, water: 80 },
    consumption: {food: 1, water: 1},
    get available(){
      if( engine.state.unlocks.organizeddiggers == 'unlocked' ){
        return engine.tier < 2; 
      } else {
        return engine.tier == 1;
      }
    },
    bugclass: Digger,
    unlockcondition: function () {
        return ( engine.counter('Nworkers') > 21 );
    },
    bug: true,
    color: "blue",
  },

  storagecavern: {
    type: 'structure',
    get title() { return 'Storage Cavern'; },
    description: 'A large underground cavern for storing food and water',
    unlockmessage: "Now that you have a digger you can create much bigger storage structures",
    get price() { return {
      food:  100*engine.buynumber,
      water: 100*engine.buynumber };
    },
    buildtime: 10,
    oncomplete: function(){
      engine.increase_counter('storagecaverns');
      engine.resources.water.storage += 1000;
      engine.resources.food.storage += 1000; },
    unlockcondition: function () {
        return ( engine.counter('Ndiggers') > 0 );
    }
  },

  organizeddiggers: {
    type: 'upgrade',
    title: 'Organized Diggers',
    description: 'Organize diggers into a group lead by a specialised nurser',
    unlockmessage: "Maybe tweak a nurser to produce diggers?",
    price: { food:500, water: 500 },
    upgradeeffect: function() { },
    unlockcondition: function () {
        return ( engine.counter('storagecaverns') > 2 );
    }
  },


  /* Tier 2 unlocks */
  leaddigger: {
    type: 'bug',
    title: 'Lead Digger',
    price: { food: 50, water: 50 },
    consumption: {food: 0.2, water: 0.2},
    get available(){ return false },
    bugclass: Leaddigger,
    unlockcondition: function () {},
    bug: true,
    leader: true,
    color: 'red',
    childtype: 'digger',
    grouptype: 'diggergroup',
    egginterval: function(tier){
      return 10*Math.pow( 4, tier )/engine.perks.lander.egginterval;
    },
    ondeath: function( gather, buglist, tier ){
      if( engine.state.unlocks.smartnurser=='unlocked' ){
        var success = engine.buybug( 'leaddigger', buglist, tier );
        if( success )
              buglist[0].age = 5;
      }
    }
  },

  diggergroup: {
    type: 'bug',
    unlockmessage: "A nest size group of builders can create caverns very quickly. That's a lot of diggers, though, and they need feeding. You should probably detach first.",
    names: { 1: 'Digger Group',
             2: 'Digger Group',
             3: 'Builder Nest',
             4: 'Build Cluster',
             5: 'Colonial Landscaper',
             6: 'Landscaper Colony',
    },
    defaultname: "Tunnelling Group",
    get title()  {
          var title = this.names[engine.tier];
          if( title == undefined ) title = this.defaultname;
          return title;
    },
    descriptions: {
             1: "Create a group of diggers and a specialized nurser to control them. This will create 7 diggers at once.",
             2: "Create a group of diggers and a specialized nurser to control them. This will create 21 diggers at once.",
             3: 'A nestfull of builders for medium scale construction.',
             4: 'A cluster of builders for medium scale construction.',
             5: 'A builder unit for continental megastructures.',
             6: 'An entire colony dedicated to transforming the environment.',
    },
    defaultdescription: "A group of diggers large enough for a planetary colony.",
    get description()  {
      var title = this.descriptions[engine.tier];
      if( title == undefined ) title = this.defaultdescription;
      return title;
    },
    tier_price: function ( tier ) {
      let t=tier-1;
      let price = 50*Math.pow( 7, t+1 );
      for( let  n = t; n>=0; n-- ){
        price += 80*Math.pow( 6, n )*Math.pow( 7, t-n );
      }
      return { food: 1.1*price, water: 1.1*price};
    },
    get price( ) {
      return this.tier_price( engine.tier )
    },
    get available(){
      if( engine.tier == 1 ){
        return true;
      }
      if( engine.tier > 1 && engine.tier < 9 && engine.state.unlocks.construction ){
        return true;
      }
      if( engine.tier > 1 && engine.perks.longrangecommunication ){
        return true;
      }
      return false;
    },
    unlockcondition: function () {
      return ( engine.state.unlocks.organizeddiggers == 'unlocked' );
    },
    group: true,
    color: 'blue',
    bugclass: Diggergroup,
    leaderclass: Leaddigger,
    groupclass: Diggergroup,
    memberclass: Digger,
    membertype: 'digger',
  },

  /* Tier 3 */
  construction: {
    type: 'upgrade',
    title: 'Construction',
    description: 'Build nest sized structures',
    unlockmessage: "As the number of bugs grows, you're starting to think a bit more clearly",
    price: { food:10000, water: 10000 },
    upgradeeffect: function() { 
      display.story( "A nest size group of builders can create caverns very quickly. That's a lot of diggers, though, and they need feeding. You should probably detach first." );
     },
    unlockcondition: function () {
        return (  engine.counter('Nworkers') > 500 );
    }
  },

  workergroup: {
    type: 'bug',
    names: { 1: 'Group',
             2: 'Supergroup',
             3: 'Nest',
             4: 'Cluster',
             5: 'Supercluster',
             6: 'Colony',
             7: 'Greater Colony',
             8: 'Supercolony',
             9: 'Hypercolony',
             10: 'Planetary Colony',
             11: 'Solar Colony',
             12: 'Stellar Colony',
             13: 'Stellar Supercolony',
             14: 'Interstellar Colony'
    },
    defaultname: "HBB (Huge Bunch of Bugs)",
    get title()  {
          var title = this.names[engine.tier];
          if( title == undefined ) title = this.defaultname;
          return title;
    },
    descriptions: {
             1: "Create a group of seven standard worker bugs lead by a nurser",
             2: "Build larger group, made of smaller groups",
             3: "Make a swarming nest that controls its surrounding territory",
             4: "Create an organized group of nests spread over an ecosystem",
             5: "Build a larger group made of smaller groups",
             6: "Send an army of workers and diggers establish a colony in a different ecosystem",
             7: "Venture into the far reaches of your world to find life sustaining ground and resources",
             8: "Build a larger group made of smaller groups",
             9: "Cover a continent with bugs and create a teeming network of tunnels into it's soil",
             10: "Send a huge colony to a planet or an asteroid in your current solar system",
             11: "Create colonies over a bunch of harvested asteroids",
             12: "Create bands of colonies orbiting your star",
             13: "Send an exodus to take over a new solar system",
             14: "Take control of a sufficiently close nit stellar cluster"
    },
    defaultdescription: "Expand your reach in the galaxy",
    get description()  {
      var title = this.descriptions[engine.tier];
      if( title == undefined ) title = this.defaultdescription;
      return title;
    },
    unlockmessage: "With some planning and extra resources, you can create a whole group at once. No waiting or micromanaging. When bugs are created at once, they will usually also die at the same time. That's good to keep in mind.",
    tier_price: function ( tier ) {
      let t=tier-1;
      let price = 10*Math.pow( 7, t+1 );
      for( let  n = t; n>=0; n-- ){
        price += 20*Math.pow( 6, n )*Math.pow( 7, t-n );
      }
      return { food: 1.1*price, water: 1.1*price};
    },
    get price( ) {
      return this.tier_price( engine.tier )
    },
    get available(){
      if( engine.tier > 0 && engine.tier < 9 ){
        return true;
      } else if( engine.perks.longrangecommunication ){
        return true;
      }
      return false;
    },
    bugclass: Workergroup,
    unlockcondition: function () {
        return ( engine.counter('Nworkers') > 300 );
    },
    group: true,
    color: 'green',
    leaderclass: Nurser,
    groupclass: Workergroup,
    memberclass: Worker,
    membertype: 'worker',
  },
  

  foodhint: {
    type: 'special',
    unlockmessage: "Notice how your food production is slowing down? Your bugs are travelling further to collect food. Fortunately the water comes to you.",
    unlockcondition: function () {
      return ( engine.resources.food.gathering > 1000 &&
        engine.state.planet == "primitive" );
    }
  },

  steelproduction: {
    type: 'upgrade',
    title: 'Steel Production',
    onunlock: function() {},
    description: 'Send some workers to find iron deposits.',
    unlockmessage: "The leaders are consuming more and more of the workers output. You feel like you need to find some iron.",
    price: { food: 50000, water: 50000 },
    upgradeeffect: function() {
      engine.resources.steel.gatherable = true;
    },
    unlockcondition: function () {
      return ( engine.counter('Ndiggers') > 200 );
    }
  },

  steelworks: {
    type: 'structure',
    title: 'Steelworks',
    description: 'Build a cavern and workspace under a deposit.',
    get price() { return {
      food:  1000*engine.buynumber,
      water: 1000*engine.buynumber
    }; },
    buildtime: 10000,
    oncomplete: function(){
      engine.increase_counter('steelworks');
      engine.resources.steel.gatherable = true;
      engine.resources.steel.storage += 10;
    },
    unlockcondition: function () {
        return ( engine.state.unlocks.steelproduction == 'unlocked' );
    }
  },

  steelcluster: {
    type: 'bug',
    title: 'Steel Cluster',
    description: 'These specialised bugs produce a strong acid that melts iron out of the ground.',
    price: { food:10000, water: 10000 },
    get available(){ return ( 
      engine.tier > 3 &&
      engine.counter('Nsteelclusters') < engine.counter('steelworks')
    );},
    bugclass: Steelcluster,
    unlockcondition: function () {
      return ( engine.state.unlocks.steelproduction == 'unlocked' );
    },
    group: false,
    cangather: {steel: 'forced'},
    gatherspeed: {steel: 1},
    consumption: {food: 200, water: 400},
    defence: 100,
    color: 'blue',
  },

  waterpump: {
    type: 'structure',
    title: 'Water Pump',
    get description() {
      if( engine.state.unlocks.automated_pumps ){
        return('An automated pump requires 1k workers for maintenance, but can pump 100k water.');
      } else {
        return("A simple pipe and pump mechanism to make water gathering faster. Allows 1k workers to gather 2k water.");
      }
    },
    unlockmessage: "Steel is usefull for all kinds of construction",
    get price() { return {
      food:  1000*engine.buynumber,
      water: 1000*engine.buynumber,
      steel: engine.buynumber};
    },
    buildtime: 10000,
    oncomplete: function(){
      engine.increase_counter('waterpumps');
    },
    unlockcondition: function () {
        return ( engine.resources.steel.amount > 1 );
    }
  },

  reserve: {
    type: 'structure',
    title: 'Reserve',
    description: 'Create an artificial lake right above your tunnel network. Easy access to water!',
    unlockmessage: "Water pumps are fast and efficient, but you need storage as well.",
    get price() { return {
      food:  1000*engine.buynumber,
      water: 1000*engine.buynumber,
      steel: engine.buynumber};
    },
    buildtime: 100000,
    oncomplete: function(){
      engine.increase_counter('reserves');
      engine.resources.water.storage += 1000000;
    },
    unlockcondition: function () {
        return ( engine.counter('waterpumps') > 0 );
    }
  },

  farm: {
    type: 'structure',
    title: 'Farm',
    get description() {
      if( engine.state.unlocks.automated_farms ){
        return('An automated farm requires 1k workers for maintenance, but allows growing 100k food.');
      } else {
        return('Grow food directly in your colony. Allows 1k workers to produce 1k food.');
      }
    },
    unlockmessage: "How about running a water pump on some of that moss?",
    get price() { return {
      food:  2000*engine.buynumber,
      water: 2000*engine.buynumber,
      steel: engine.buynumber};
    },
    buildtime: 15000,
    oncomplete: function(){
      engine.increase_counter('farms');
    },
    unlockcondition: function () {
        return ( engine.counter('waterpumps') > 0 );
    }
  },

  foodcave: {
    type: 'structure',
    title: 'Food Cave',
    description: 'A large steel fortified food storage cave',
    get price() { return {
      food:  1000*engine.buynumber,
      water: 1000*engine.buynumber,
      steel: engine.buynumber};
    },
    buildtime: 10000,
    oncomplete: function(){
      engine.increase_counter('foodcaves');
      engine.resources.food.storage += 100000;
    },
    unlockcondition: function () {
        return ( engine.resources.steel.amount > 1 );
    }
  },

  /* Tier 4 */
  oilproduction: {
    type: 'upgrade',
    title: 'Oil Production',
    onunlock: function() {},
    description: 'Start building up fuel for launch',
    unlockmessage: "You are starting to get settled and it's time to start sending landers. First you need fuel. Mixing bug food with certain enzymes and water creates a sticky substance you can use.",
    price: { food: 100000, water: 100000, steel: 10 },
    upgradeeffect: function() {
      engine.resources.oil.gatherable = true;
    },
    unlockcondition: function () {
      return ( engine.counter('farms') > 0 );
    }
  },

  oilvat: {
    type: 'structure',
    title: 'Decomposition Vat',
    description: 'A drainable vat for processing food into fuel',
    unlockmessage: "You need to make eggs and send them on their way. To do that you need to produce energy dense fuel by processing food with special enzymes.",
    get price() { return {
      food:  10000*engine.buynumber,
      water: 10000*engine.buynumber,
      steel: engine.buynumber
      };
    },
    buildtime: 10000,
    oncomplete: function(){
      engine.increase_counter('oilvats');
      engine.resources.oil.storage += 5;
    },
    unlockcondition: function () {
       return ( engine.state.unlocks.oilproduction == 'unlocked' );
    }
  },

  fuelcavern: {
    type: 'structure',
    title: 'Fuel Cavern',
    description: 'A cavern for storing the highly flammable oil',
    unlockmessage: "You should build some storage caverns under the oil vat",
    get price() { return {
      food:  1000*engine.buynumber,
      water: 1000*engine.buynumber,
      steel: 2*engine.buynumber,
      };
    },
    buildtime: 10000,
    oncomplete: function(){
      engine.increase_counter('storagecaverns');
      engine.resources.oil.storage += 10;
    },
    unlockcondition: function () {
        return ( engine.counter('oilvats') > 0 );
    }
  },

  oilcluster: {
    type: 'bug',
    title: 'Oil Mixer',
    description: 'A large group with specialized worker bugs to operate an oil vat, mixing oil out of food, water and digestive enzymes.',
    price: { food:10000, water: 10000 },
    get available(){ return (
      engine.tier > 3 &&
      engine.counter('Noilclusters') < engine.counter('oilvats')
    );},
    bugclass: Oilcluster,
    unlockcondition: function () {
        return ( engine.counter('oilvats') > 0 );
    },
    group: false,
    cangather: {oil: 'forced'},
    gatherspeed: {oil: 1},
    consumption: {food: 5000, water: 1000},
    defence: 100,
    color: 'black',
  },

  cannon: {
    type: 'unique structure',
    title: 'Cannon',
    description: 'A simple method for launching lander eggs into space. A tunnel that runs straight down, reinforced with steel.',
    unlockmessage: "Once you build a cannon, you can start launching eggs into space.",
    get available(){
      if( engine.counter('cannons') == 0 ){
        for( key in engine.buildqueue )
          if( engine.buildqueue[key].type == 'cannon' )
            return false;
        return true
      }
      return false
    },
    get price() { return {
      food:  1000,
      water: 1000,
      steel: 10 };
    },
    buildtime: 10000,
    oncomplete: function(){
      engine.increase_counter('cannons');
      engine.state.unlocks.cannon = 'unlocked';
    },
    unlockcondition: function () {
        return ( engine.resources.oil.amount > 9 );
    }
  },

  grandqueen: {
    type: 'bug',
    title: 'Grand Queen',
    description: 'The Grand Queen produces a single lander egg during its lifetime',
    unlockmessage: "You need to produce some lander eggs to launch, of course. You need a Grand Queen for that.",
    price: { food:10000, water: 10000 },
    consumption: {food: 10, water: 10},
    update: function( buglist, i, tier ){
      if( buglist[i].age > 20/engine.perks.lander.egginterval ){
        if( new_lander_egg() )
          engine.killbug( buglist, i, tier );
      }
    },
    available: true,
    bugclass: Grandqueen,
    unlockcondition: function () {
        return ( engine.resources.oil.amount > 9 );
    },
    group: false,
    color: 'red',
  },

  launch: {
    type: 'prestige',
    title: 'Launch',
    description: 'This is it. Launch the Lander eggs into space and hope for the best. After this you can relax and enjoy the rest of your years on this planet',
    unlockmessage: "Everythings ready to go for launch. Just make sure that your offspring will be better of than you are.",
    price: { oil: 20 },
    upgradeeffect: function() {
      // Rebate the price, it's used later
      engine.resources.oil.amount += 20;
      launch();
      engine.state.unlocks.launch = true;
    },
    unlockcondition: function () {
      return false;
    }
  },

  inspect_egg: {
    type: 'prestige',
    title: 'Inspect Lander',
    description: 'Inspect the lander egg you are about to launch into space.',
    unlockmessage: "",
    price: {},
    upgradeeffect: function() {
      show_lander_egg();
      engine.state.unlocks.inspect_egg = true;
    },
    unlockcondition: function () {
      return engine.state.unlocks.launch;
    }
  },
  
  /* Tier 5 */
  compactor: {
    type: 'unique structure',
    title: 'Compactor',
    description: 'Shove more food into your lander eggs. Lets you increase starting resources at the expense of using more oil per launch',
    unlockmessage: "You could make your landers life easier by packing in some resources. Water would evaporate but food could survive the trip.",
    get available(){
      if( engine.counter('compactors') == 0 ){
        for( key in engine.buildqueue )
          if( engine.buildqueue[key].type == 'compactor' )
            return false;
        return true
      }
      return false
    },
    get price() { return {
      food:  2000,
      water: 2000,
      steel: 10};
    },
    buildtime: 15000,
    oncomplete: function(){
      engine.state.unlocks.compactor = 'unlocked';
    },
    unlockcondition: function () {
        return ( engine.counter('Nworkers') > 50000 );
    }
  },

  /* Above  6 */

  autocannon: {
    type: 'structure',
    title: 'Automated Cannon',
    description: "Build an automatic cannon for launching eggs.",
    unlockmessage: "Why do you operate the cannon? There are enough bugs around to automate launching the eggs.",
    get price() { return {
      food:  1000*engine.buynumber,
      water: 1000*engine.buynumber,
      water: 500*engine.buynumber};
    },
    buildtime: 15000,
    oncomplete: function(){
      engine.increase_counter('autocannons');
      display.story( "Now that feels good." );
    },
    unlockcondition: function () {
        return ( engine.counter('Nworkers') > 5000000 );
    },
  },

  geneticengineering: {
    type: 'upgrade',
    title: 'Genetic Engineering',
    description: "By comparing the genomes of your different insects, you can probably pick individual features from the lander egg genomes. You need some kind of laboratory and lots of energy.",
    unlockmessage: "Tinkering a bit more with the landers genetic makeup is very useful.",
    price: { food:100, water: 10000, oil: 200, steel: 100 },
    upgradeeffect: function() { },
    unlockcondition: function () {
        return ( engine.counter('Nworkers') > 150000 );
    }
  },

  diggerspeed_perk: {
    type: 'upgrade',
    title: 'Mandible Genetics',
    description: "Start tinkering with the genes that control digger mandibles. Bigger is better?",
    unlockmessage: "Digging speeds are the most important bottleneck. Maybe your geneticists could find a way creating faster diggers.",
    price: { food:100000, water: 100, oil: 10 },
    upgradeeffect: function() { 
      engine.next_perks.lander.diggerspeed = 1;
      engine.perks.lander.diggerspeed = 1;
     },
    unlockcondition: function () {
        return ( engine.next_perks.lander.diggerspeed == undefined && 
        engine.state.unlocks.geneticengineering == 'unlocked' &&
        engine.counter('Ndiggers') > 16000 );
    }
  },

  /*** Soldiers and self defence 
  ***/
  self_defence: {
    type: 'upgrade',
    title: 'Self Defence',
    description: "By taking genes from a worker and a digger, you can create a menacing critter do defend your workers.",
    unlockmessage: "These local creatures have talons and jaws to defend themselves. Maybe you should, too.",
    price: { food:10000, water: 10000, oil: 50 },
    upgradeeffect: function() { 
      engine.perks.self_defence = true;
      engine.next_perks.self_defence = true;
      display.story("You need to make some oil to launch the egg.");
    },
    unlockcondition: function () {
        return ( engine.state.planet == 'complex' && 
        engine.perks.self_defence == undefined &&
        engine.counter('Nworkers') > 100000 );
    }
  },

  soldierspeed_perk: {
    type: 'special',
    unlockmessage: "Your soldiers are basically just diggers that live above ground. After a couple of generations they should become a lot more effective.",
    onunlock: function() {
      engine.next_perks.lander.soldierspeed = 1;
      engine.perks.lander.soldierspeed = 1;
    },
    unlockcondition: function () {
        return ( engine.next_perks.lander.soldierspeed == undefined && 
                 engine.next_perks.self_defence );
    }
  },

  soldier: {
    type: 'bug',
    title: 'Soldier',
    description: 'Make a strong but nimble soldier to protect the workers',
    price: { food: 20, water: 20 },
    consumption: {food: 5, water: 5},
    get available(){
        return engine.tier == 1;
    },
    bugclass: Soldier,
    unlockcondition: function () {
        return ( engine.perks.self_defence );
    },
    bug: true,
    color: "blue",
  },

  leadsoldier: {
    type: 'bug',
    title: 'Lead Soldier',
    price: { food: 20, water: 20 },
    consumption: {food: 5, water: 5},
    get available(){ return false },
    bugclass: Leadsoldier,
    unlockcondition: function () {
      return engine.state.unlocks.self_defence;
    },
    bug: true,
    leader: true,
    color: 'red',
    childtype: 'soldier',
    grouptype: 'soldiergroup',
    egginterval: function(tier){
      return 10*Math.pow( 4, tier )/engine.perks.lander.egginterval;
    },
    ondeath: function( gather, buglist, tier ){
      if( engine.state.unlocks.smartnurser=='unlocked' ){
        var success = engine.buybug( 'leadsoldier', buglist, tier );
        if( success )
          buglist[0].age = 5;
      }
    }
  },

  soldiergroup: {
    type: 'bug',
    title: 'Soldier Squad',
    description: 'A group of soldiers to protect your workers.',
    tier_price: function ( tier ) {
      let t=tier-1;
      let price = 20*Math.pow( 7, t+1 );
      for( let  n = t; n>=0; n-- ){
        price += 20*Math.pow( 6, n )*Math.pow( 7, t-n );
      }
      return { food: 1.1*price, water: 1.1*price};
    },
    get price( ) {
      return this.tier_price( engine.tier )
    },
    available: true,
    bugclass: Soldiergroup,
    unlockcondition: function () {
        return ( engine.state.unlocks.soldier &&
                 engine.state.unlocks.organizeddiggers );
    },
    group: true,
    color: 'blue',
    leaderclass: Leadsoldier,
    groupclass: Soldiergroup,
    memberclass: Soldier,
    membertype: 'soldier',
  },

  /* Modern food production */
  microfarming: {
    type: 'upgrade',
    title: 'Microfarming',
    description: "You need a small farm. Some trial and error will be needed, but you can do it. Otherwise you will die.",
    unlockmessage: "There is no food. You need to build something like a miniature farm.",
    price: { food: 50, water: 10, steel: 1 },
    upgradeeffect: function() { 
      engine.perks.microfarming = true;
      engine.next_perks.microfarming = true;
    },
    unlockcondition: function () {
        return ( engine.state.planet == 'lifeless' &&
        engine.perks.microfarming == undefined );
    }
  },

  microfarm: {
    type: 'structure',
    title: 'Microfarm',
    description: 'Allows you to grow food. Requires a seed investment to get started.',
    unlockmessage: "Microfarms would reduce the need to go find food.",
    get price() { return {
      food:  2*engine.buynumber,
      water: engine.buynumber};
    },
    buildtime: 0.005,
    oncomplete: function(){
      engine.increase_counter('microfarms');
    },
    unlockcondition: function () {
        return ( engine.perks.microfarming );
    }
  },

  moss_engineering_perk: {
    type: 'upgrade',
    title: 'Moss Engineering',
    description: "Work out the genetic code of the moss and start breeding it for food production.",
    unlockmessage: "The moss has a genetic code. It came with you and it will leave with your children. Why not tinker with it as well",
    price: { food:100000, water: 100, oil: 10 },
    upgradeeffect: function() {
      engine.perks.lander.farm_efficiency = 1;  engine.next_perks.lander.farm_efficiency = 1; },
    unlockcondition: function () {
      return ( engine.state.planet == 'lifeless' && 
      engine.state.unlocks.geneticengineering=='unlocked' );
    }
  },


  /* Automation perks from intelligent planet */
  automation: {
    type: 'upgrade',
    title: 'Automation',
    description: "The only reason seems to be to save food. That's reason enough.",
    unlockmessage: "These creatures build funny mechanisms do things without needing workers. It might be worth looking into.",
    price: { food: 1000, water: 10000, steel: 10 },
    upgradeeffect: function() { 
      engine.perks.automation = true;
      engine.next_perks.automation = true;
    },
    unlockcondition: function () {
        return ( engine.state.planet == 'intelligent' &&
        engine.perks.automation == undefined &&
        engine.counter('Nworkers') > 2000000 );
    }
  },

  automated_pumps: {
    type: 'upgrade',
    title: 'Automated Pumps',
    description: 'Use the power of the river to pump the water.',
    price: { food: 1000, water: 10000, steel: 100 },
    upgradeeffect: function() { 
      pumps = engine.counter('waterpumps');
      engine.increase_counter('waterpumps', by=-0.99*pumps);
      console.log('The number of pumps reduced to ', engine.counter('waterpumps'));
    },
    unlockcondition: function () {
        return ( engine.state.planet == 'intelligent' &&
        engine.perks.automation == true &&
        engine.counter('Nworkers') > 2000000 );
    }
  },

  automated_farms: {
    type: 'upgrade',
    title: 'Automated Farms',
    description: 'Use the power of the river to power the waterpumps for your farms.',
    price: { food: 1000, water: 10000, steel: 100 },
    upgradeeffect: function() { 
      engine.perks.automation = true;
      engine.next_perks.automation = true;
      pumps = engine.counter('farms');
      engine.increase_counter('farms', by=-0.99*pumps);
      console.log('The number of farms reduced to ', engine.counter('farms'));
    },
    unlockcondition: function () {
        return ( engine.state.planet == 'intelligent' &&
        engine.perks.automation == true &&
        engine.counter('Nworkers') > 3000000 );
    }
  },

  refrigeration: {
    type: 'upgrade',
    title: 'Refrigeration',
    description: 'Another technique you can copy from the critters here. They can keep food cold almos anywhere.',
    price: { food: 100, water: 1000, steel: 10 },
    upgradeeffect: function() { 
      engine.perks.refrigerated_storage = true;
      engine.next_perks.refrigerated_storage = true;
    },
    unlockcondition: function () {
        return ( engine.state.planet == 'intelligent' &&
        engine.perks.automation == true &&
        engine.counter('Nworkers') > 4000000 );
    }
  },

  refrigerated_storage: {
    type: 'structure',
    title: 'Refrigerated Storage',
    description: "A cold storage cave with room for a huge amount of food.",
    get price() { return {
      food:  200*engine.buynumber,
      water: 10000*engine.buynumber,
      steel: 5*engine.buynumber};
    },
    buildtime: 50000,
    oncomplete: function(){
      engine.increase_counter('foodcaves',300);
      engine.resources.food.storage += 3000000;
    },
    unlockcondition: function () {
        return ( engine.state.planet == 'intelligent' &&
        engine.perks.refrigerated_storage &&
        engine.counter('Nworkers') > 500000 );
    }
  },

  /* Large colonies only allowed after reaching tier 7 with intelligent */
  longrangecommunication: {
    type: 'upgrade',
    title: 'Long Range Communication',
    unlockmessage: "The critters here seem to communicate using very low frequency light. They make complicated machines to do it but you should only need a long antenna, like a nerve.",
    description: 'Play with nerves to produce and listen to radio waves. Should allow a bigger colony.',
    price: { food: 1000, water: 1000, steel: 100 },
    upgradeeffect: function() { 
      engine.perks.longrangecommunication = true;
      engine.next_perks.longrangecommunication = true;
    },
    unlockcondition: function () {
      return ( engine.state.planet == 'intelligent' && 
               engine.counter('Nworkers') > 4000000 );
    }
  },



  /* The ending */
  selfimprovement: {
    type: 'upgrade',
    title: 'Self Improvement',
    unlockmessage: "The thing with tinkering on eggs and shooting them into space is that you don't benefit at all. I just feels good.",
    description: 'Maybe there is a way to engineer your own bugs instead of the landers.',
    price: { food: 500000000, water: 1000000000, steel: 1000 },
    unlockcondition: function () {
      return ( engine.counter('Nworkers') > 80000000 );
    },
    upgradeeffect: function() { 
      engine.state.unlocks.selfimprovement = 'unlocked';
    },
  },

  geneticslab: {
    type: 'structure',
    title: 'Genetics Lab',
    description: 'Allows you to apply any improvemnets from lander eggs directly to yourself.',
    unlockmessage: "With a proper genetics lab you can tinker with the eggs you produce to make them compatible with yourself.",
    get available(){
      if( engine.counter('geneticslabs') == 0 ){
        for( key in engine.buildqueue )
          if( engine.buildqueue[key].type == 'geneticslab' )
            return false;
        return true
      }
      return false
    },
    get price() { return {
      food:  2000,
      water: 2000,
      steel: 10};
    },
    buildtime: 15000,
    oncomplete: function(){
      engine.state.unlocks.geneticslab = 'unlocked';
      display.story("Now you can try with a new lander egg.");
    },
    unlockcondition: function () {
        return ( engine.state.unlocks.selfimprovement == 'unlocked' );
    }
  },

  happiness: {
    type: 'upgrade',
    title: 'Happiness',
    unlockmessage: "The need to produce oil, to launch landers, to expand. The resources will run out. You inherited all of this, it's in your genes. You can change that.",
    description: 'Escape. Remove the need to produce landers from your genes. Make yourself happy.',
    price: { food: 100, water: 100, steel: 10 },
    upgradeeffect: function() { 
      engine.perks.happy = true;
      engine.next_perks.happy = true;
    },
    unlockcondition: function () {
      return ( engine.counter('Nworkers') > 400000000 && 
        engine.state.unlocks.geneticslab == 'unlocked' );
    }
  },

  happy: {
    type: 'special',
    title: 'Happy',
    unlockmessage: "You feel OK.",
    unlockcondition: function () {
      return ( engine.perks.happy );
    }
  },

  planet_choice: {
    type: 'special',
    unlockmessage: "For what seems like an infinite lenght of time, you float accross vast distances. Without any understanding of how long you have slept, you know you are now falling into the gravitational well of a star.",
    unlockcondition: function () {
      return ( engine.perks.launched == true );
    },
    onunlock: function() {
      select_planet();
    },
  },

};



/* Construct a table showing lander properties */
function lander_table( lander, isnew = true ){
  var table = {};
  if(isnew){ 
    table = {' ': [ ' ', 'current', 'New', '']};
  }
  for( let key in engine.perks.lander ) if(key != 'initial_resources')
    if(landerperks[key]) {
    /* Add the new and the old value to the table for displaying */
    let title_span = $("<span><\span>").text(landerperks[key].title);
    title_span.mouseenter( function(){ display.showtooltip(this,landerperks[key].description); } );
    title_span.mouseout( function(){ display.hidetooltip(); } );
    table[key] = [title_span];

    if(isnew) {
      let n=1;
      if( engine.next_perks.lander[key] )
        n = Math.floor(engine.next_perks.lander[key]*100)/100;
      table[key][1] = [n.toPrecision(3)];
        n = Math.floor(lander[key]*100)/100;
      table[key][2] = [n.toPrecision(3)];

      if( engine.state.unlocks.geneticengineering == 'unlocked' ){
        /* Allows the player to select individual traits */
        let addbutton = $("<span><\span>").text('Isolate');
        addbutton.addClass("btn btn-info");
        addbutton.click( function(){
          isolate_trait(lander, key);
          display.hidetooltip();
          display.dismissPopup();
        });
        addbutton.mouseenter( function(){
          display.showtooltip(addbutton,'Pick only this feature, but destroy the egg')  ; 
        } );
        addbutton.mouseout( function(){ display.hidetooltip(); } );  
        table[key][3] = [addbutton];
      } else {
        table[key][3] = [''];
      }
    } else {
      let n=Math.floor(engine.next_perks.lander[key]*100)/100;
      table[key][1] = [n.toPrecision(3)];
    }
  }
  return table;
}

/* Create a new lander egg */
function new_lander_egg(){
  if( engine.frozen == false ){
    engine.pause();

    let lander = {};
    for( let key in engine.perks.lander ) if(key != 'initial_resources') {
      lander[key] = engine.perks.lander[key]*( 0.85+0.4*Math.random());
    }
    let table = lander_table(lander);

    popup = {
      title: "A new lander egg has been produced!",
      text: "Use this one or reject it?",
      table: table,
      accept: { text: 'Keep', run: function(){
        keep_lander_egg(lander);
        engine.state.unlocks.launch = true;
        display.dismissPopup();
        if( engine.resources.oil.amount >= 20 ){
          launch();
        } else {
          display.story("You need more oil to launch the egg.");
        }
      }},
      reject: { text: 'Reject', run: function(){
        display.dismissPopup();
      }}
    };

    /* Display and ask to keep or reject */
    display.popup( popup );
    engine.unlock('cannon');
    return true;
  } else {
    return false;
  }
}

/* Replace current perks with a new perk object */
function keep_lander_egg(lander){
  for( let key in lander){
    engine.next_perks.lander[key] = lander[key];
    if( engine.state.unlocks.geneticslab == 'unlocked' )
      engine.perks.lander[key] = lander[key];
  }
}

/* Replace only one train from a lander egg */
function isolate_trait(lander, key){
  engine.next_perks.lander[key] = lander[key];
  engine.state.unlocks.launch = true;
  if( engine.state.unlocks.geneticslab == 'unlocked' )
    engine.perks.lander[key] = lander[key];
}

/* Launch the lander egg */
var buttoninterval;
function set_interval_click( button, clickfunction ){
  button.mousedown(function() {
    clickfunction();
    buttoninterval = setInterval(clickfunction, 100 );
  });
  button.mouseup(function() {
    clearInterval(buttoninterval);
  });
}

function show_lander_egg(){
  let table = lander_table(engine.next_perks.lander, isnew=false);
  popup = {
    title: "Your landers properties:",
    table: table,
    accept: { text: 'Ok', run: function(){
      display.dismissPopup();
    }}
  };

  /* Display and ask to keep or reject */
  display.popup( popup );
}

function launch(){
  if( engine.frozen == false ){
    engine.pause();
    let oil_required = 20;
    let text=' ';
    let table = {};
    let lander_resources = engine.next_perks.initial_resources;
    if( engine.state.unlocks.compactor == 'unlocked' ){
  
      let weight = 10; /* weight of the egg itself */
      weight += lander_resources.food.amount/10;
      weight += lander_resources.steel.amount*100;
  
      oil_required = weight; //A bit simplistic
  
      oil_num = display.metricformat(Math.floor(oil_required));
      text = ''+oil_num+' oil required.</p><p>Packed resources:';    
  
      for( let key in lander_resources ) if( key != 'water' && key != 'oil' ){
        /* Display the current value */
        let n = Math.floor(lander_resources[key].amount*100)/100;
        let num = display.metricformat(n);
        
        // Add and subtract buttons
        let addbutton = $("<span><\span>").text('+');
        addbutton.addClass("btn btn-primary");
        set_interval_click( addbutton, function(){increase_res(key);} );
        
        let subtractbutton = $("<span><\span>").text('-');
        subtractbutton.addClass("btn btn-primary");
        set_interval_click( subtractbutton, function(){decrease_res(key);} );

        let title_span = $("<span><\span>").text(key);
  
        table[key] = [ title_span, num, addbutton, subtractbutton];
      }
    }
  
    var accept;
    if( oil_required > engine.resources.oil.amount ){
      accept = { 
        text: 'Insufficient oil', 
        run: function(){ }
      };
    } else {
      accept = { 
        text: 'Launch!', 
        run: function(){
          engine.soft_reset();
          engine.perks.launched = true;
          engine.state.unlocks.planet_choice = false;
          engine.next_perks.initial_resources = lander_resources;
          display.dismissPopup();
        }
      };
    }
  
    popup = {
      title: "Ready to lauch",
      text: text,
      table: table,
      accept: accept,
      reject: { text: 'Wait a second!', run: function(){
        display.dismissPopup();
      }}
    };
  
    display.popup( popup );
  }
}

function increase_res(key){
  display.dismissPopup();
  amount = engine.next_perks.initial_resources[key].amount;
  if( amount > 10 ){
    engine.next_perks.initial_resources[key].amount *= 1.1;
  } else {
    engine.next_perks.initial_resources[key].amount += 1;
  }
  engine.next_perks.initial_resources[key].storage = engine.next_perks.initial_resources[key].amount;
  launch();
}

function decrease_res(key){
  display.dismissPopup();
  amount = engine.next_perks.initial_resources[key].amount;
  if( amount > 10 ){
    engine.next_perks.initial_resources[key].amount /= 1.1;
  } else if(amount > 9) {
    engine.next_perks.initial_resources[key].amount = 9;
  } else {
    engine.next_perks.initial_resources[key].amount -= 1;
  }
  if( engine.next_perks.initial_resources[key].amount < 0 )
    engine.next_perks.initial_resources[key].amount = 0;
  if( engine.next_perks.initial_resources[key].amount > initial_resources[key].storage )
    engine.next_perks.initial_resources[key].storage = engine.next_perks.initial_resources[key].amount;
  launch();
}

/* This is run if bugs is empty */
function colony_death(){
  display.story( "As the last of your bugs die you fade out of existence" );
  display.story( "Maybe one of your siblings did better" );
  display.story( "(Click 'Reset Colony' to run a sibling colony)" );
  engine.pause();
}

function select_planet(){
  engine.pause();
  let table = {};
  table[' '] = [];
  for( let key in planets ){
    // Add and subtract buttons
    let button = $("<span><\span>")
    let title = $("<b><\b>").text(key);
    let description = $("<div><\div>").text(planets[key].description);
    button.append(title);
    button.append(description);
    button.addClass("btn btn-primary");
    title.css("text-transform","capitalize");
    button.css("width","192px");
    button.css("height","128px");
    title.css("margin","2px");
    description.css("word-wrap","normal");
    description.css("white-space","normal");
    button.click( function(){ 
      engine.state.planet = key;
      display.dismissPopup();
    });
    table[' '].push( button );
  }

  popup = {
    title: "Your landers, launched one by one, spread in all directions and to a variety of worlds.",
    text: 'Choose a planet:',
    table: table,
  };

  display.popup( popup );
}
