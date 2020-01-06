/* Manage display elements and interaction */

display = (function(){
  
  /* Display messages in the story display */
  function displayStory( text ){
    engine.state.story = engine.state.story+"<p>"+text+"</p>"
    $('#storyDisplay').append("<p>"+text+"</p>");
    let height = $('#storyDisplay')[0].scrollHeight;
    $('#storyDisplay').scrollTop( height );
  }
  
  
  /* Display an alert in the popup box */
  function displayPopupAlert( text ){
    display_popup( {
      title: text,
      accept: { text: 'Ok', run: function(){
        dismissPopup();
      }},
    });
  }
  
  /* Display a popup with optional elements listed in a dictionary.
   * Possible elements are: title, text, table, accept and reject.
   * Accept and reject are dictionaries with 2 values, text and run,
   * where text is the button laben and run is the function run on
   * click
   */
  function display_popup( popup ){
    deconstructPopup();

    if( popup.title ) {
      var title = $("<h4></h4>").html(popup.title);
      title.addClass('popup_remove'); //Mark for removal when dismissed
      $("#popupAlertButton").before(title);
    }
  
    if( popup.text != undefined ) {
      var text = $("<p></p>").html(popup.text);
      text.addClass('popup_remove'); //Mark for removal when dismissed
      $("#popupAlertButton").before(text);
    }
  
    if( popup.table ) {
      let table = $("<table></table>");
      table.addClass('popup_remove'); //Mark for removal when dismissed
      $("#popupAlertButton").before(table);
  
      for( let key in popup.table ){
        let row = $("<tr></tr>");
        table.append(row);
  
        let col = $("<td></td>").html(popup.table[key][0]);
        col.addClass('lander_table_key');
        row.append(col);
  
        for( let i = 1; i < popup.table[key].length; i++ ){
          let col = $("<td></td>").append(popup.table[key][i]);
          col.addClass('lander_table_num');
          row.append(col);
        }
      }
    }

    /* Display and set onclick method to buttons */
    if( popup.accept ){
      $("#popupAlertButton").css("display","inline-block");
      $("#popupAlertButton").text(popup.accept.text);
      $("#popupAlertButton").click( popup.accept.run );
    } else {
      $("#popupAlertButton").css("display","none");
    }
    if( popup.reject ){
      $("#popupAlertCancelButton").css("display","inline-block");
      $("#popupAlertCancelButton").text(popup.reject.text);
      $("#popupAlertCancelButton").click( popup.reject.run );
    } else {
      $("#popupAlertCancelButton").css("display","none");
    }

    $("#popupAlert").css('display', 'inline-block');
  }

  function deconstructPopup(){
    $("#popupAlert").css("display","none");
    $("#popupAlertButton").css("display","inline-block");
    
    /* Clean up elements tagged for removing */
    $(".popup_remove").remove();

    /* Dismiss click handlers */
    $("#popupAlertButton").off( "click" );
    $("#popupAlertCancelButton").off( "click" );
  }
  
  /* Dismiss the popup */
  function dismissPopup() {
    deconstructPopup();
  
    /* Continue running updates if frozen */
    engine.run();
  }
  
  
  
  /* Format a number using metric extentions */
  function metricformat( n ){
    var exponents = [
      { value: 1e18 , suffix: 'P' },
      { value: 1e15 , suffix: 'E' },
      { value: 1e12 , suffix: 'T' },
      { value: 1e9 , suffix: 'G' },
      { value: 1e6 , suffix: 'M' },
      { value: 1e3 , suffix: 'k' }
    ];
  
    for (var i = 0; i < exponents.length; i++) {
      if (n >= exponents[i].value) {
        return ( n / exponents[i].value ).toPrecision(3) + exponents[i].suffix;
      }
    }
    return Math.round(n).toString();
  }
  
  
  /* Hide the tooltip */
  function hidetooltip( ){
    $("#tooltip").hide();
  }

  /* Build the tooltip and display */
  function showtooltip( element, type ){
    //Set the tooltip text
    var item = items[type];
    $("#tooltiptitle").text(item.title);
    $("#tooltiptext").text(item.description);
  
    /* Color green if can afford, red if cannot */
    $("#tooltipprice").css('color','green');
    
    /* Gray out if it's a bug and there are already 8 */
    if( item.type == 'bug' && engine.bugs.length > 7 )
      $("#tooltipprice").css('color','gray');

    /* Gray out if it's a leader and there already is one*/
    if( item.leader && engine.bugs[0].leader )
      $("#tooltipprice").css('color','gray');
    
    /* check the price */
    var price = items[type].price;
    for (let key in price )
      if( price[key] > engine.resources[key].amount )
        $("#tooltipprice").css('color','red');
    
    /* Set the text content of the price section */
    var text = "";
    for (let key in price ){
      text += key +": " + metricformat( price[key] ) + "  ";
    }
    $("#tooltipprice").text(text);
    
    /* Display */
    $("#tooltip").show();
  
    var position = $(element).offset();
    var width = $(element).width();
    var tooltipheight = $("#tooltip").outerHeight();
    
    $("#tooltip").css('top',position.top-tooltipheight+'px');
    $("#tooltip").css('left',position.left+0.5*width+'px');
  }

  /* A tooltip that only shows the text given */
  function simpletooltip(element, text){
    //Set the tooltip text
    $("#tooltiptext").text(text);
  
    $("#tooltipprice").text('');
    $("#tooltiptitle").text('');
    
    /* Display */
    $("#tooltip").show();
  
    var position = $(element).offset();
    var width = $(element).width();
    var tooltipheight = $("#tooltip").outerHeight();
    
    $("#tooltip").css('top',position.top-tooltipheight+'px');
    $("#tooltip").css('left',position.left+0.5*width+'px');
  }
  
  
  
  /***** Item displays ******/
  /* Get or create a button for the given item type */
  function getbutton( key ){
    var item = items[key];
    
    /* Try to retrieve the button, create if not found */
    var button = $("#"+key+"Button");
    if( button.length == 0 ){
      button=$("<span></span>");
      button.attr('id',key+'Button');
      button.addClass("button");
      button.css('display','inline-block');
      if( item.type == 'bug' ){
        button.click( function(){ engine.buybug( key ); });
      } else if( item.type == 'structure' ) {
        button.click( function(){ engine.startbuild( key ); });
      } else if( item.type == 'unique structure' ) {
        button.click( function(){ engine.startbuild( key, number = 1 ); });
      } else if( item.type == 'upgrade' ){
        button.click( function(){ engine.getupgrade( key ); });
      } else if( item.type == 'prestige' ) {
        button.click( function(){ engine.getupgrade( key ); });
      }
      button.mouseenter( function(){ showtooltip(this,key); } );
      button.mouseout( function(){ hidetooltip(); } );

      /* container is the appropriate section in the control panel */
      container = item.type;
      if(item.type == 'unique structure')
        container = 'structure';
      $("#"+container).append(button);
    }
    return button;
  }
  
  
  /* Show the buttons in the control panel */
  function showbuttons(){
    /* Hide the containers */
    $('#bug').hide();
    $('#structure').hide();
    $('#upgrade').hide();
    
    /* Go through all items and draw any unlocked ones */
    for( let key in items ) {
      var item = items[key];
      if( item.type != 'special' ){
        // Show only if unlocked and tier, if defined, matches current tier
        if( engine.state.unlocks[key] == true &&
          ( item.tier == undefined || item.tier == engine.state.tier) &&
          ( item.available == undefined || item.available)
        ) {
          // Get and display the button
          let button = getbutton( key );
          button.text(item.title);
          button.css('display','inline-block');
          if(item.type == 'unique structure'){
            $('#structure').show();
          } else {
            $('#'+item.type).show();
          }
          button.removeClass('buttongray');
          button.addClass('button buttonup');
  
          // Check for price and color the button gray if cannot afford
          var price = items[key].price;
          for( let resource in price )
            if( price[resource] > engine.resources[resource].amount ){
              button.removeClass('buttonup');
              button.addClass('buttongray');
            }
          
          // Gray out bugs if there are already 8
          if( item.type=='bug' && engine.bugs.length > 7 ){
            button.removeClass('buttonup');
            button.addClass('buttongray');
          }

          // Gray out leaders if the group has one
          if( item.leader && engine.bugs[0] && engine.bugs[0].leader ){
            button.removeClass('buttonup');
            button.addClass('buttongray');
          }
        } else {
          //Locked or bought, don't display
          let button = getbutton( key );
          button.css('display','none');
        }
      }
    }
  
    //Display the kill button
    if( engine.state.unlocks.killbug == true ){
      document.getElementById('killbugButton').style.display='inline-block';
    } else {
      document.getElementById('killbugButton').style.display='none';
    }
  
  }
  
  
  /* set the buynumber button colors */
  function setbuynumbercolors( ) {
    $("#buyamountbutton1").removeClass('buyamountbuttondown');
    $("#buyamountbutton10").removeClass('buyamountbuttondown');
    $("#buyamountbutton100").removeClass('buyamountbuttondown');
  
    $("#buyamountbutton"+engine.buynumber).addClass('buyamountbuttondown');
  }
  
  
  
  
  /****** Draw parts of the bug display ******/
  
  /* Get a gather button or create it */
  function getgatherbutton( key, index ){
    var id = 'gather'+key+index;
    var button = $("#"+id);
  
    /* If not found, create */
    if( button.length==0 ){
      button = $("<span></span>").text(key);
      button.attr('id',id);
      button.addClass("gatherButton");
      button.show();
      button.click( function(){
        engine.gatherclick(event, engine.bugs,index-1,key);
      });
      $("#gatherBox"+index).append(button);
    }

    return button[0];
  }
  
  /* Draw the gather box for a bug number */
  function drawgathers(index){
    /* First set the visibility of the gather box */
    var box = $('#gatherBox'+(index+1));
    if( engine.bugs[index].hatched ) {
      box.show();
    } else {
      box.hide();
    }

    /* Check what the bug can gather of command to gather */
    let bug = engine.bugs[index];
    let counts = {};
    if( bug.leader ){
      counts = engine.current.topcount;
      if(items[bug.type].childtype){
        counts[items[bug.type].childtype] = 1;
      }
    } else {
      counts = engine.current.counts[index];
    }
    
    /* Set the styles of individual gather buttons */
    for( let key in engine.resources ){
      let button = getgatherbutton( key, index+1 );
      if( button ) {
        /* Set visibility */
        var gather = false;
        if( engine.resources[key].gatherable == true ){
          for( let bugitem in counts ) if( items[bugitem] && items[bugitem].cangather != undefined )
          {
            if( items[bugitem].cangather[key] == 'select' ){
              gather = 'select';
              break;
            }
            if( items[bugitem].cangather[key] == 'forced' ){
              gather = 'forced';
            }
          }
        }
        if( gather == 'select' ){
          $('#gather'+key+(index+1)).css('display','inline-block');
          $('#gatherBox'+(index+1)).show();

          if(engine.bugs[index] && engine.bugs[index].leader ){
            $('#gather'+key+(index+1)).mouseenter( function(){ simpletooltip(button,"Send newly hatched workers to gather "+key); } );
            $('#gather'+key+(index+1)).mouseout( function(){ hidetooltip(); } );
          } else {
            $('#gather'+key+(index+1)).unbind("mouseenter");
            $('#gather'+key+(index+1)).unbind("mouseleave");
          }

        } else if( gather == 'forced' ){
          $('#gather'+key+(index+1)).css('display','inline-block');
          $('#gatherBox'+(index+1)).show();
          $('#gather'+key+(index+1)).css('background-color','gray');
        } else {
          $('#gather'+key+(index+1)).css('display','none');
        }
  
        /* And class */
        if( engine.bugs[index].gather == key ){
          button.className = 'gatherButton gatherbuttondown';
        } else {
          button.className = 'gatherButton gatherbuttonup';
        }
      }
    }
  }
  
  /* Generate and draw the description of a bug */
  function drawbugtext(i){
    var bug = engine.bugs[i];
    let name
    if( bug.bugs ){
      name = bug.bugs[0].name
    } else {
      name = bug.name
    }

    $('#name'+(i+1)).text(name);

    var text = "";
    if( bug.age == undefined || bug.age > 5 ){
      text += "</br>"+items[bug.type].title;
    } else {
      text += "</br>A soft white egg";
    }

    if( bug.bugs ){
      let counts = engine.current.counts[i];
      for (let key in counts){
        let number = metricformat( counts[key] );
        text += "</br> "+number+" "+key;
        if( counts[key] > 0)
          text += "s";
      }
    }

    if( bug.age != undefined ){
      text +=   "</br>age: "+parseInt(bug.age);
    }

    if( bug.leader && bug.hatched && bug.egginterval != undefined ){
      var childname = items[bug.type].childtype.toLowerCase();
      if(engine.tier > 0){
        var group = items[bug.type].grouptype;
        if( items[group].names ) {
          childname = items[group].names[engine.tier-1].toLowerCase();
        } else {
          childname = items[group].title.toLowerCase();
        }
      }
      var interval = items[bug.type].egginterval(engine.tier);
      if(interval > engine.perks.lander.max_age ){
        text += "</br>Will not live long enough to create an egg ";
      } else {
        text +=   "</br>Produces a "+childname+" every "+metricformat(interval)+" seconds";
      }
    }
    if( bug.leader && engine.tier < engine.state.maxtier ) {
      text +=   "</br>(Click to zoom out)";
    }
    
    $('#text'+(i+1)).text(""); /* erase */
    $('#text'+(i+1)).append(text); /* append, with working line breaks */
  }
  
  
  /* Draw the bug display number i */
  function drawbugdisplay(i){
    if( engine.bugs[i] != undefined ) {
      $('#bug'+(i+1)).css('display','block');
  
      drawgathers(i);
      drawbugtext(i);
  
      //Set the color of the bug avatar
      var color;
      if( items[engine.bugs[i].type].bugs != undefined ) {
        color = group_color(engine.bugs[i]);
      } else {
        color = items[engine.bugs[i].type].color;
      }
      $('#avatar'+(i+1)).css('backgroundColor',color);
  
    } else if(i<8) {
      
      //Bug slot is empty, no display
      $('#bug'+(i+1)).hide();
      $('#gatherBox'+(i+1)).hide();
  
    }
  }
  
  
  /* Redraw all periodically updated stuff */
  function draw( ){
    if( engine.resources.water.amount <= 0 || engine.resources.food.amount <= 0 ){
      $("#stateInfo").css('background-color', 'red');
    } else {
      $("#stateInfo").css('background-color', '#eeeeee');
    }

    if( engine.tier > 0 ){
      $("#tierdisplay").show();
    }
    $("#tierdisplay").text("Tier "+engine.tier);

    /* Refresh bug displays */
    for(var i=0; i<8; i++){
      drawbugdisplay(i);
    }
  
    /* Refresh the control buttons */
    showbuttons();
  
    /* Color the buy number buttons */
    setbuynumbercolors( );
  
  
    /* Write the resource display text */
    // Empty the display
    var row = $('#stateInfo_table');
    row.html('');

    // Add resources
    var text;
    var keyrow = $('<tr></tr>');
    for( let key in engine.resources )
      if(engine.resources[key].gatherable || engine.resources[key].amount > 0 ){

      text = "<class id='resource_name'>" + key + "</span> ";
      keyrow.append( $('<td></td>').html(text) );
    }

    // Add bug counts
    for(let i=0; i<display_count.length; i++){
      key = 'N'+display_count[i];
      if( engine.state[key] > 0 ){
        text = "<class id='resource_name'>" + display_count[i] + "</span> ";
        keyrow.append( $('<td></td>').html(text) );
      }
    }
    row.append(keyrow);

    var amountrow = $('<tr></tr>');
    for( let key in engine.resources )
      if(engine.resources[key].gatherable || engine.resources[key].amount > 0 ){
      let am = metricformat( Math.floor( engine.resources[key].amount ));
      let st = metricformat( Math.floor( engine.resources[key].storage ));
        
      text = ""+am+"/"+st;
      amountrow.append( $('<td></td>').text(text) );
    }

    // Add bug counts
    for(let i=0; i<display_count.length; i++){
      key = 'N'+display_count[i];
      if( engine.state[key] > 0 ){
        let am = metricformat( Math.floor(engine.state[key]) );
        text = ""+am ;
        amountrow.append( $('<td></td>').text(text) );
      }
    }
    row.append(amountrow);

    var gatherrow = $('<tr></tr>');
    for( let key in engine.resources )
      if(engine.resources[key].gatherable || engine.resources[key].amount > 0 ){
      let gt = get_gathering(key);
      text = "Gathering "+metricformat( Math.floor( gt ));+"/s";
      gatherrow.append( $('<td></td>').text(text) );
    }
    row.append(gatherrow);

    var consumerow = $('<tr></tr>');
    for( let key in engine.resources )
      if(engine.resources[key].gatherable || engine.resources[key].amount > 0 ){
      text = "Using "+metricformat( Math.floor( engine.resources[key].average ))+"/s";
      consumerow.append( $('<td></td>').text(text) );
    }
    row.append(consumerow);

    // Dangerlevel
    if( dangerlevel() > 0.01 ){
      let am = metricformat( Math.floor(10*dangerlevel()) );
      text = "\xa0 danger: " +am ;
      row.append( $('<td></td>').text(text) );
    }
  
    /* Draw the build tracker */
    text = "";
    if( engine.state.buildqueue[0] ){
      timeleft = metricformat( Math.floor(engine.state.buildqueue[0].time/buildspeed()) );
      text = items[engine.state.buildqueue[0].type].title + " (" +  timeleft  + "s)";
      $('#buildtracker').text(text);
      if( engine.state.buildqueue.length > 1 ){
        text = "  (Queue: " + (engine.state.buildqueue.length-1) + ")";
        $('#buildtracker').append(text);
      }
      $('#buildcancelbutton').show();
    } else {
      text = "Nothing in queue";
      $('#buildtracker').text(text);
      $('#buildcancelbutton').hide();
    }
  }

  
  return {
    draw: draw,

    popup: display_popup,
    dismissPopup: dismissPopup,
    popupAlert: displayPopupAlert,

    showtooltip: simpletooltip,
    hidetooltip: hidetooltip,
    
    story: displayStory,
    
    bug: drawbugdisplay,
    
    metricformat: metricformat,
    setbuynumbercolors: setbuynumbercolors,
    getbutton: getbutton,
  };

})();