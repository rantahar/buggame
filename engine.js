/* The engine contains functions dealing with updating the colony, saving and loading.
 */

engine = (function(){
  
  /* Define variables that will be set later */
  var state;
  var resources;
  var perks, next_perks;
  var bugs_loaded = false;

  /* The bug list starts empty */
  var bugs = [];
  var toptier = bugs;

  /* Bring standard timestep to 1 unit / second */
  var timestep = 0.001;

  /* Transitory information */
  var current = {};

  /* Initial state of a run */
  var initial_state = {
    /* general status */
    maxtier: 0,
    tier: 0,
    tierup: undefined,
    /* The status of unlockable items */
    unlocks: {},
    /* Building in queue */
    buildqueue: [],
    story: ""
  };

  /*
   * Base for standard non-leader bugs
   */
  var Bug = function Bug () {
    this.gather = 'none';
    this.age = 0;
    this.hatched = false;
    this.name = 'Bug';
    this.isbug = true
  };
  
  /*
   * Base for leader bugs
   */
  var Leader = function Leader () {
    Bug.call(this);
    this.egginterval = 10;
    this.sincelastegg = 0;
    this.leader = true;
  };

  /*
   * Base for groups
   */
  var Group = function Group () {
    this.gather = 'none';
    this.bugs = undefined;
    this.group = true;
  };

  /* Reset the game */
  function resetGame( ){
    console.log("Resetting");
    /* Wipe the story display */
    $("#storyDisplay").text("");
      
    /* Reset state, but keep current perks */
    if( next_perks == undefined ){
      perks = new Perklist();
      next_perks = new Perklist();
    } else {
      next_perks = JSON.parse(JSON.stringify(perks));
    }

    /* Set the starting state */
    // get_initial_resources is defined in data
    resources = JSON.parse(JSON.stringify( get_initial_resources() ));

    state = JSON.parse(JSON.stringify(initial_state));
    toptier = get_startbugs();
    bugs = toptier;

    if( custom_setup != undefined )
      custom_setup();
  
    freeze = false;
  }
  
  /* Soft reset. Copy next_perks to perks and reset */
  function soft_reset(){
    perks = JSON.parse(JSON.stringify(next_perks));
    resetGame();
    checkunlocks();
  }

  /* Soft reset. Copy next_perks to perks and reset */
  function hard_reset(){
    perks = undefined;
    resetGame();
    checkunlocks();
  }

  /* Confirm before resetting */
  function confirmReset(){
    display.popup( {
      title: "Abandon this colony and start a new one?",
      text: "This will not affect your current perks",
      accept: { text: 'Yes', run: function(){
        resetGame();
        display.dismissPopup();
      }},
      reject: { text: 'No', run: function(){
        display.dismissPopup();
      }}
    } );
  }

  /* Confirm before hard reset */
  function confirmHardReset(){
    display.popup( {
      title: "Completely wipe your game?",
      accept: { text: 'Yes', run: function(){
        perks = new Perklist();
        next_perks = new Perklist();
        resetGame();
        display.dismissPopup();
      }},
      reject: { text: 'No', run: function(){
        display.dismissPopup();
      }}
    } );
  }

  function ondatabaseupgradeneeded(event) {
    var db = event.target.result;
    var objectStore = db.createObjectStore(
      'objectStoreName'
    );
  };

  function ondatabaseerror(event) {
    console.log('The database is opened failed');
  };
  
  async function addbugs() {
    let request = indexedDB.open('bugs-game-data', 1);
    request.onupgradeneeded = ondatabaseupgradeneeded;
    request.onerror = ondatabaseerror;

    request.onsuccess = function(event){
      let db = event.target.result;
      let tx = db.transaction('objectStoreName', 'readwrite');
      let store = tx.objectStore('objectStoreName');
      let request = store.count('bugs');
      request.onsuccess = function(e) {
        let count = e.target.result;
        if (count > 0) { // key already exist
          let request = store.put({ content: toptier }, 'bugs');
          request.onsuccess = function(event) { 
            db.close();
          };
        } else { // key not exist
          let request = store.add({ content: toptier }, 'bugs');
          request.onsuccess = function(event) {
            db.close();
          };
        }
      };
    }
  }

  function getbugs() {
    let request = indexedDB.open('bugs-game-data', 1);
    request.onupgradeneeded = ondatabaseupgradeneeded;
    request.onerror = ondatabaseerror;

    request.onsuccess = function(event){
      let db = event.target.result;
      let tx = db.transaction('objectStoreName', 'readwrite');
      let store = tx.objectStore('objectStoreName');
      let request = store.get('bugs');
      request.onsuccess =  function(event) {
        toptier = event.target.result.content;
        db.close();
        bugs_loaded = true;
      };
    }
  }


  /* Save the game */
  async function save( prefix='' ){
    console.log('saving');
    addbugs();
    var start_time = Date.now();
    localStorage.setItem(prefix+'resources', JSON.stringify(resources));
    localStorage.setItem(prefix+'state', JSON.stringify(state));
    localStorage.setItem(prefix+'perks', JSON.stringify(perks));
    localStorage.setItem(prefix+'next_perks', JSON.stringify(next_perks));
    var end_time = Date.now();
  }

  function update_version(){
    if(state.planet == undefined){
      state.planet = 'primitive';
    }
    new_perks = new Perklist();
    for (var key in new_perks.lander ){
      if (new_perks.lander[key] == undefined){
        perks.lander[key] = new_perks.lander[key];
        next_perks.lander[key] = new_perks.lander[key];
      }
    }
    delete perks.lander.waterspeed;
    delete next_perks.lander.waterspeed;
    if( state.story == undefined ){
      state.story = "";
    }
  }
  
  
  /* Load the game */
  async function load( prefix='' ){
    getbugs();
    while( !bugs_loaded ){
      function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
      await sleep(500);
    };
    
    resources = JSON.parse(localStorage.getItem(prefix+'resources'));
    state = JSON.parse(localStorage.getItem(prefix+'state'));
  
    perks = JSON.parse(localStorage.getItem(prefix+'perks'));
    next_perks = JSON.parse(localStorage.getItem(prefix+'next_perks'));
  
    update_version();
    
    display.story(state.story);

    if( state.unlocks == undefined ){
      state.unlocks = {};
    }

    bugs = toptier;
    state.tier = state.maxtier;
    current.tierup = undefined;
    
    var g = recalcgathering();
    var c = recalcconsuming();
    for (var key in resources ){
      if(g[key]) {
        resources[key].gathering = g[key];
      } else {
        resources[key].gathering = 0;
      }
      if(c[key]) {
        resources[key].consuming = c[key];
      } else {
        resources[key].consuming = 0;
      }
    }
  }

  // Get consumption either from item or bug object
  function bug_consumption(bug){
    if( bug.consumption ){
      return bug.consumption;
    } else {
      var bugitem = items[bug.type];
      return bugitem.consumption;
    }
  }

  // Get gatherspeed either from item or bug object
  function bug_gatherspeed(bug){
    if( bug.gatherspeed ){
      return bug.gatherspeed;
    } else {
      var bugitem = items[bug.type];
      return bugitem.gatherspeed;
    }
  }

  /* Calculate resource use by traveling down the tree */
  function recalcconsuming( buglist = toptier ){
    var c = {};
    for( var i=0; i<buglist.length; i++){
      if( buglist[i].bugs == undefined ){
        if( buglist[i].hatched && items[buglist[i].type] ){
          let ci = bug_consumption(buglist[i]);
          for( var resource in ci){
            if(c[resource]){
              c[resource] += ci[resource];
            } else {
              c[resource] = ci[resource];
            }
          }
        }
      } else {
        let ci = recalcconsuming( buglist[i].bugs );
        for( var resource in ci){
          if(c[resource]){
            c[resource] += ci[resource];
          } else {
            c[resource] = ci[resource];
          }
        }
      }
    }
    return c;
  }
  
  /* Calculate resource gathering by traveling down the tree */
  function recalcgathering( buglist = toptier ){
    var c = {};
    for( var i=0; i<buglist.length; i++){
      if( buglist[i].bugs == undefined ){
        if( buglist[i].hatched && buglist[i].gather ){
          var gatherspeed = bug_gatherspeed(buglist[i]);
          var resource = buglist[i].gather;
          if( gatherspeed && gatherspeed[resource]) {
            if(c[resource]){
              c[resource] += gatherspeed[resource];
            } else {
              c[resource] = gatherspeed[resource];
            }
          }
        }
      } else {
        let ci = recalcgathering( buglist[i].bugs );
        for( var resource in ci){
          if(c[resource]){
            c[resource] += ci[resource];
          } else {
            c[resource] = ci[resource];
          }
        }
      }
    }
    return c;
  }

  /* Safely increase a counter in state (each stored in state) */
  function increase_counter( key, by=1 ){
    if(state[key]==undefined)
      state[key] = 0;
    state[key] += by;
  }

  /* Get the value of a counter */
  function counter( key ){
    if(state[key]==undefined)
      state[key] = 0;
    return state[key];
  }

  function count_group( bugs, tier = engine.tier ){
    let counts = {};
    for( var i=1; i<bugs.length; i++ ){
      let bug = bugs[i];
      let this_count = {};
      if( bug.isbug && !bug.leader ){
        this_count[bug.type] = 1;
      }
      if( bug.group ){
        if( bug.bugs ){
          this_count = count_group(bug.bugs, tier-1);
        } else {
          this_count = bug.count;
        }
      }
      for( key in this_count ){
        if( counts[key] == undefined ){
          counts[key] = 0;
        }
        counts[key] += this_count[key];
      }
    }
    return counts;
  }
  

  
  /****** Handle unlocks and upgrades ******/
  /* Check items, color buttons and unlock */
    
  /* Check for unlocks */
  function checkunlocks(){
    for( var key in items )
      if( !state.unlocks[key] && items[key].unlockcondition() )
        unlock( key );
  }

  /* Unlock an item */
  function unlock( key ){
    var item = items[key];
    if( !state.unlocks[key] ){
      if( item.unlockmessage )
        display.story( item.unlockmessage );
      if( item.onunlock )
        item.onunlock();
      state.unlocks[key] = true;
    }
  }
 
 
  /****** Buying bugs and upgrades ******/

  /* Check if there are enough resources to buy an item */
  function canafford( price ){
    let affordable = true;
      for( let key in price )
      affordable = affordable && resources[key].amount >= price[key];
    return affordable;
  }
 
  /*** Bugs ***/
  function buybug( type, buglist = bugs, tier = state.tier ){
    if( type == undefined)
     return false;
    
    var canbuy = true;

    /* Check for space */
    canbuy = canbuy && tier >=0 && buglist.length < 8 ;

    /* If it's a leader, check that one doesn't exist */
    canbuy = canbuy && !( items[type].leader && buglist[0] && buglist[0].leader );

    /* Fetch the price and check for resources */
    var price;
    if( items[type].tieredprice ){
      price = items[type].tieredprice( tier );
    } else {
      price = items[type].price;
    }
    canbuy = canbuy && canafford( price );

    if( canbuy ){
      /* Create the bug and add to buglist */
      var index = buglist.length;
      if(items[type].makenew == undefined){
        var bug = new items[type].bugclass( tier );
        if( items[type].group && bug.bugs == undefined ){
          instantiate( bug, tier, false );
        }
      } else {
        var bug = items[type].makenew( tier );
      }
      if( items[bug.type].leader ){
        for( let i=index; i>0; i-- )
          buglist[i] = buglist[i-1];
        buglist[0] = bug;
      } else {
        buglist[index] = bug;
      }

      for( let key in price )
        resources[key].amount -= price[key];
      return true;
    }
    
    return false;
  }
 
 
  /*** Structures ***/
 
  /* Number of structures to buy */
  var buynumber = 1;
 
  /* Add structure to build queue */
  function startbuild( key, number = buynumber ){
    /* Check for price and resources */
    var price = items[key].price ;
    var can_affort = true;
    for( let resource in price){
      can_affort = can_affort && resources[resource].amount >= price[resource];
    }
 
    if( can_affort ) {
      /* Add to queue */
      for( let resource in price)
        resources[resource].amount -= price[resource];
      for( var i=0; i<number; i++ )
        state.buildqueue.push( {type: key, time: items[key].buildtime } );
    }
  }

  function calcelbuild(){
    for( let i=0; i<buynumber; i++ ){
      let inqueue = state.buildqueue.length;
      if( inqueue > 0 ){
        var key = state.buildqueue[inqueue-1].type;
        var price = items[key].price;
        for( key in price){
          resources[key].amount += price[key];
        }
        state.buildqueue.shift();
      }
    }
  } 
 
  /*** Upgrades ***/
 
  /* Buy an upgrade */
  function getupgrade( key ){
    /* Check for price and resources */
    var price = items[key].price ;
    var can_affort = true;
    for( let resource in price ){
      can_affort = can_affort && resources[resource].amount >= price[resource];
    }
    
    if( can_affort ) {
      for( let resource in price ){
        resources[resource].amount -= price[resource];
      }
      state.unlocks[key] = 'unlocked';
 
      /* Get the upgrade */
      items[key].upgradeeffect();
    }
  }
 
 
  /* Create a group object for curent tier and increase max tier */
  function detachment(){
    if( toptier[0].leader ){
  
      var oldtop = toptier;
      grouptype = items[toptier[0].type].groupclass;
      toptier = [ new grouptype( state.maxtier+1 ) ];
      toptier[0].bugs = oldtop;
      bugs = toptier;
  
      bugs[0].gather = bugs[0].bugs[0].gather;
      bugs[0].hatched = undefined;
      bugs[0].age = undefined;
  
      state.maxtier += 1;
      state.tier = state.maxtier;
  
      for(var i=0; i<8; i++)
        display.bug(i);
    }
  }
  
  /* Drop down a tier after due to a dead nurser or a failed challenge */
  function reattachment(){
    toptier = toptier[0].bugs;
    bugs = toptier;
    current.tierup = undefined;
    state.maxtier -= 1;
    state.tier = state.maxtier;
    for(var i=0; i<8; i++){
      instantiate(bugs[i], state.tier, true);
      display.bug(i);
    }
  
    display.story("You feel a horrible dread. Your highest tier could not replace itself and the lower tier is on it's own. You feel small.");
  }
  
  
  
  /**** Manipulate the gather state of a bug ****/
  /* Zero current gather state */
  function zerogathers( bug ){
    if( bug.bugs == undefined && bug.hatched ) {
      var key = bug.gather;
      var gatherspeed = bug_gatherspeed(bug);
      if( resources[key] && items[bug.type] &&
          gatherspeed && gatherspeed[key] ){
        resources[key].gathering -= gatherspeed[key];
      }
    }
    bug.gather = 'none';
  }
  
  
  /* Toggle a gather state */
  function setgather( bug, resource ){
    var bug_g = {};
    var gatherspeed = bug_gatherspeed(bug);
    if( gatherspeed ) {
      bug_g = gatherspeed;
    }

    if( bug.bugs ){
      var leader = bug.bugs[0];
      if(items[leader.type].cansetgather && items[leader.type].cansetgather[resource]) {
        zerogathers( bug );
        bug.gather = resource;
        leader.gather = resource;
      }
      for( var i=1; i<bug.bugs.length; i++ )
        setgather( bug.bugs[i], resource );
    } else if(items[bug.type].leader){
      if(items[bug.type].cansetgather && items[bug.type].cansetgather[resource]) {
        bug.gather = resource;
      }
    } else {
      if( bug_g[resource] != undefined ){
        zerogathers( bug );
        bug.gather = resource;
        if( bug.hatched && bug_g[resource] ){
          resources[resource].gathering += bug_g[resource];
        }
      }
    }
  }
  

  /****** Update bug states ******/
  /* Hatch an old enough egg */
  function hatch(buglist,i, count = true){
    var bug = buglist[i];
    if( bug.hatched == false ){
      var gather = bug.gather;
      bug.gather = 'none';
      
      bug.hatched = true;
      if( gather != 'none') setgather( bug, gather );

      if( count ){
        countername = 'N'+bug.type+'s';
        increase_counter(countername);
      }
      if( bug.count ) for( key in bug.count ) {
        countername = 'N'+key+'s';
        increase_counter(countername, bug.count[key]);
      }

      let consumption = bug_consumption(bug);
      for( let resource in consumption ){
        resources[resource].consuming += consumption[resource];
      }
    }
  }


  /* Kill a bug */
  function killbug( buglist, i, tier ){
    var bug = buglist[i];

    // The item type of the dying bug
    var type = bug.type;
    var item = items[type];

    // Gather state of the dying bug
    var gather = bug.gather;

    if( bug.hatched == true ) {
      //Hatched bugs are counted, remove the dead one
      var countername = 'N'+type+'s';
      increase_counter(countername,-1);
      
      if( bug.count ) for( key in bug.count ) {
        countername = 'N'+key+'s';
        increase_counter(countername, -bug.count[key]);
      }

      if( bug.bugs == undefined ){
        //Bugs consume resources. After death they no longer should.
        let consumption = bug_consumption(bug);
        for( let key in bug.consumption ){
          resources[key].consuming -= consumption[key];
        }
      }

      zerogathers(bug);
    }

    if( item.group && bug.bugs ){
      //Descent and handle children
      for( var k=bug.bugs.length-1; k>=0; k-- ){
        killbug( bug.bugs, k, tier-1 );
      }
    }
 
    //Reorder the list
    for(j = i; j < buglist.length-1; j++) {
      buglist[j] = buglist[j+1];
    }
    //and remove the bug :(
    buglist.splice(-1,1);
 
    /* Run bug specific ondeath function */
    if(item.ondeath)
      item.ondeath( gather, buglist, tier);
  }
 
 
  /********* Instantiate an new group  *********/
  function instantiate_bug( bug, tier ){
    if( bug && items[bug.type].group && bug.bugs == undefined ){
      //Create the group
      var t =  tier-1;
      if( t > 0 ) {
        bug.bugs = [new items[bug.type].leaderclass(t)];
        for( let j=1; j<8; j++){
          bug.bugs[j]= new items[bug.type].groupclass(t);
        }
      } else {
        //Lowest tier, actual bugs here
        bug.bugs = [new items[bug.type].leaderclass(0)];
        for( let j=1; j<8; j++)
          bug.bugs[j] = new items[bug.type].memberclass(0);
      }
      bug.hatched = undefined;
      bug.age = undefined;
    }
  }

  function instantiate( bug, tier ){
    if( bug && !bug.bugs ){
      var gather = bug.gather;
      var isold = bug.hatched;
      zerogathers(bug);

      instantiate_bug( bug, tier );
      if( bug.bugs ) for( let i=1; i<bug.bugs.length; i++ ){
        var child = bug.bugs[i];
        if( items[child.type].group && child.bugs == undefined ) {
          instantiate_bug( child, tier-1 );
        }
        
        if( items[child.type].bug && isold ){
          child.age = Math.random() * get_max_age();
        }
      }

      setgather(bug, gather);
    }
  }
 
 
  /****** Tier changes ******/
  function tierup( ){
    if( state.tier < state.maxtier ){
      state.tier += 1;
      bugs = current.tierup.bugs;
      current.tierup = current.tierup.tierup;
 
      //Instantiate all visible bugs
      for(let i=0; i<8; i++) {
        instantiate( bugs[i], state.tier );
        display.bug(i);
      }
    }
  }
 
 
  function tierdown(i){
    if(items[bugs[i].type].group){
      state.tier -= 1;
      var tierup = current.tierup;
      current.tierup = {bugs: bugs, index: i, tierup: tierup};
      bugs = bugs[i].bugs;
 
      //Instantiate all visible bugs
      for(let i=0; i<8; i++) {
        instantiate( bugs[i], state.tier );
        display.bug(i);
      }
    }
  }


  /* Toggle the state of the kill button */
  var killstate=false;
  function togglekillbutton(){
    if( killstate ){
      killstate = false;
      $('#killbugButton').addClass('killbutton');
      $('#killbugButton').removeClass('killbuttonactive');
    } else {
      killstate = true;
      $('#killbugButton').addClass('killbutton killbuttonactive');
    }
  }
  
  
  /* Bug click handler */
  function bugclickhandler( i ){
    if(event)
      event.stopPropagation();
    if( killstate ){
      if( bugs.length > 1 ){
        killbug( engine.bugs, i, engine.state.tier );
      } else {
        display.story("Don't");
      }
    } else {
      if( items[engine.bugs[i].type].leader ){
        tierup();
      } else {
        tierdown( i );
      }
    }
  }

  /* Click gather buttons */
  function gatherclick( event, buglist, index, resource ){
    var bug = buglist[index];
    var gather = bug.gather;
    event.stopPropagation();
    setgather( buglist[index], resource );
    display.bug(index);

    // Handle leader and tierup, only do on click, never automatically
    var item = items[bug.type];
    if( item && engine.current.tierup != undefined ){
      if(item.cansetgather && item.cansetgather[resource]) {
        if( gather == resource ){
          bug.gather = 'none';
        } else {
          bug.gather = resource;
        }
      }
      if( current.tierup )
        current.tierup.bugs[current.tierup.index].gather = resource;
    }
  }
 
 
 
  /* Have a leader produce a new bug every now and then */
  function leader_new_child(tier, buglist, delta){
    leader = buglist[0];
    if( leader.leader ){
      let childtype;
      if( tier == 0 ){
        childtype = items[leader.type].childtype;
      } else {
        childtype = items[leader.type].grouptype;
      }
      if( tier == 0 &&  childtype == 'emptygroup' ){
        //NOTE: I guess this could be intended behaviour
        // Should implement better tests before allowing it
        throw  "Leader at tier 0 producing leaders";
      }
      let egginterval = items[leader.type].egginterval(tier);
      if( leader.sincelastegg > egginterval*1000 ){
        var t = Math.max(0,tier);
        if( buybug(childtype, buglist, tier = t) ){
          setgather( buglist[buglist.length-1], leader.gather );
          leader.sincelastegg = 0;
          if( state.unlocks.smartnurser == 'unlocked' && items[buglist[buglist.length-1].type].bug )
            buglist[buglist.length-1].age = 5;
          if( leader === bugs[0] ){
            var childname = items[childtype].title.toLowerCase();
            display.story( leader.name+" has created a new "+childname );
          }
        }
      } else {
        leader.sincelastegg+=delta;
      }
    }
  }
 
  
  async function run_updatebugs(tier, buglist, delta, dangerlevel){
    updatebugs(tier, buglist, delta, dangerlevel);
  }
 
  /* Update the state of all bugs in a buglist, walking down the tree */
  function updatebugs( tier, buglist, delta, dangerlevel ){
    /* Check for leaders new eggs */
    if( buglist.length < 8 && buglist[0] && buglist[0].sincelastegg >= 0 )
      leader_new_child(tier, buglist,delta);
 
    /* Update the bugs */
    for ( var i = 0; i < 8; i++) if( buglist[i] ) {
      var bug = buglist[i];
 
      /* Age */
      if( bug.age != undefined) {
        bug.age += timestep*delta;
        if( bug.isbug && bug.age > get_max_age() ) {
          if( bug === bugs[i] )
            display.story(bug.name+" passed away of old age");
          killbug( buglist, i, tier );
          break;
        }
      }

      let danger = dangerlevel*timestep*delta/100;
      if(items[bug.type].defence)
        danger /= items[bug.type].defence;
      if( Math.random() < danger ){
        if(bug.isbug) {
          if( bug === bugs[i] ) {
            if( dangerlevel > 0.01 ){
              display.story(bug.name+" was probably eaten by something");
            } else {
              display.story(bug.name+" never came back");
            }
          }
          killbug( buglist, i, tier );
          break;
        }
        if( bug.group && bug.bugs == undefined ){
          // Uninstantiated group. Simulate individuals dying by a one shot punishment
          var price = items[bug.type].tier_price(tier);
          for( key in price ){
            resources[key].amount -= price[key];
          }
        }
      }
 
      /* State */
      if( bug.age == undefined || bug.age > 5 )
        hatch(buglist,i);
 
      /* Update the group if it exists */
      if( bug.group && bug.bugs) {
        updatebugs( tier-1 , bug.bugs, delta, dangerlevel  );
        /* Kill a group if it has no members */
        if( bug.bugs.length == 0 )
          killbug( buglist, i, tier );
          
        /* Kill a group if it has no leader  */
        if( buglist && bug && bug.bugs[0] && !items[bug.bugs[0].type].leader ){
          if( tier == state.maxtier && buglist.length == 1 ){
            reattachment(); /* Undo a detachment */
          } else {
            /* Also custom ondeath? */
            display.story("A leader at tier "+tier+" died but did not have the resources to produce an heir. They entrire group is slowly wandering away.");
            killbug( buglist, i, tier );
            if( bugs == buglist){
              
              tierup();
            }
          }
        }
      }
 
      /* Allow for special actions */
      if( items[bug.type].update )
        items[bug.type].update( buglist, i, tier );
    }
  }



  async function run_redo_gathers(){
    var g = recalcgathering();
    var c = recalcconsuming();
    for (var key in resources ){
      if(g[key]) {
        resources[key].gathering = g[key];
      } else {
        resources[key].gathering = 0;
      }
      if(c[key]) {
        resources[key].consuming = c[key];
      } else {
        resources[key].consuming = 0;
      }
    }
  }
 
 
  /**** Update state info ****/

  /* Save periodically */
  function save_periodic( delta ){
    if( typeof save_periodic.sincelast == 'undefined' )
      save_periodic.sincelast = 0;
    if( save_periodic.sincelast > 5000 ){
      save();
      save_periodic.sincelast = 0;
      // Do a full update of the gather states
      run_redo_gathers();
    } else {
      save_periodic.sincelast += delta;
    }
  }
  
  function count_groups(){
    /* Count bugs in groups */
    current.counts=[];
    current.topcount = {};
    for( let i=0; i < bugs.length; i++ ){
      bugtype = bugs[i].type;
      if(bugs[i].group){
        if( bugs[i].bugs ){
          current.counts[i] = count_group(bugs[i].bugs);
        }
      } else {
        current.counts[i] = {};
        if( bugs[i].hatched )
          current.counts[i][bugtype] = 1;
      }
      for( key in current.counts[i]){
        if(current.topcount[key] == undefined){
          current.topcount[key] = current.counts[i][key];
        } else {
          current.topcount[key] += current.counts[i][key];
        }
      }
    }
  }

  /* Update functions */
  /* Take a time step */
  function update(delta){
    /* When window is inactive, delta can increase by a lot. Fix to a maximum */
    delta = Math.min(delta,1000);
  
    /* Check if bugs and upgrades are available */
    checkunlocks();
  
    /* Check that there are bugs displayed */
    if( bugs.length == 0){
      state.tier = state.maxtier;
      bugs = toptier;
    }
  
    if( toptier.length == 0 ){
        colony_death();
        save();
    }
  
    /* Update resources */
    for (let key in resources) {
      var persec = get_resource_persec(key);
      resources[key].amount += persec*timestep*delta;
      if( resources[key].amount > resources[key].storage && resources[key].amount > persec ){
        if( resources[key].storage > persec ) {
          resources[key].amount = resources[key].storage;
        } else {
          resources[key].amount = persec;
        }
      }
      if( resources[key].amount < 0 )
        resources[key].amount = 0;
    }
  
    /* Update build queue */
    if( state.buildqueue[0] ){
      for( let t=timestep*delta*buildspeed(); state.buildqueue[0] && t > 0; ){
        t = 0.7*(t - state.buildqueue[0].time);
        if( t > 0 ){
          items[state.buildqueue[0].type].oncomplete();
          state.buildqueue.shift();
        }
      }
    }
  }
  
  
  
  /* Update and draw */
  mainLoop = (function() {
    var then_d = Date.now(); 
    var then_u = Date.now();
    return function() {
      now = Date.now();
      var delta_d = now - then_d;
      var delta_u = now - then_u;
      if(!freeze){
        if( delta_u > 1000){
          then_u = now;
          /* Update bugs */
          run_updatebugs(state.maxtier, toptier, Math.min(delta_u,5000), dangerlevel());
          /* Save intermittently */
          save_periodic( Math.min(delta_u,5000) );
        }
        if( delta_d > 100){
          then_d = now;
          update(delta_d);
          count_groups();
          display.draw();
        }
      }
      requestAnimationFrame(mainLoop);
    };
  })();


  /* Freeze the game (for a dialog, for example) */
  var freeze = false;
  function pause(){
    freeze = true;
  }
  function run(){
    freeze = false;
  }
  
  
  // Start things off
  function start(){
    if (typeof(Storage) == "undefined") {
      displayPopupAlert("Your browser does not support local storage. You will not be able to continue your game after you close the window.");
    }
    if ( localStorage.getItem('resources') ) {
      /* Load last saved state. This is async to wait for the database. */
      load().then(function(result) {
        if( bugs.length == 0 ){
          /* Dead, reset */
          resetGame();
          checkunlocks();
        }
        requestAnimationFrame(mainLoop);
      })
    } else {
      /* No save, reset */
      resetGame();
      requestAnimationFrame(mainLoop);
    }
  }
  
  
  return {
    soft_reset: soft_reset,
    reset: confirmReset,
    fullreset: confirmHardReset,

    start: start,
    pause: pause,
    run: run,

    increase_counter: increase_counter,
    counter: counter,

    killbug: killbug,
    buybug: buybug,
    instantiate: instantiate,
    gatherclick: gatherclick,
    bugclickhandler: bugclickhandler,
    togglekillbutton: togglekillbutton,

    startbuild: startbuild,
    calcelbuild: calcelbuild,
    detachment: detachment,
    getupgrade: getupgrade,
    unlock: unlock,

    save: save,
    load: load,

    Bug: Bug,
    Leader: Leader,
    Group: Group,

    get state()  { return state; },
    get resources()  { return resources; },
    get toptier()  { return toptier; },
    get tier()  { return state.tier; },
    get bugs()  { return bugs; },
    get current()  { return current; },

    get buynumber()  { return buynumber; },
    set buynumber(n)  { buynumber=n; display.setbuynumbercolors(n); },
    get buildqueue()  { return state.buildqueue; },

    get perks()  { return perks; },
    get next_perks()  { return next_perks; },
    get frozen() { return freeze; },
  };
})();
  