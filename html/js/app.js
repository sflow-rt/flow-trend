$(function() { 
  var restPath =  '../scripts/top.js/';
  var shortcutsURL = restPath + 'shortcuts/json';
  var keysURL =  restPath + 'flowkeys/json';
  var topURL = restPath + 'flows/json';

  var SEP = '_SEP_';

  var db = {};

  var defaults = {
    tab:0,
    hlp0:'show',
    hlp1:'hide',
    hlp2:'hide',
    keys:'',
    value:'',
    filter:'',
    topshow:50,
  };

  var state = {};
  $.extend(state,defaults);
		
  function createQuery(params) {
    var query, key, value;
    for(key in params) {
      value = params[key];
      if(value === defaults[key]) continue;
      if(query) query += '&';
      else query = '';
      query += encodeURIComponent(key)+'='+encodeURIComponent(value);
    }
    return query;
  }

  function getState(key, defVal) {
    return window.sessionStorage.getItem(key) || state[key] || defVal;
  }

  function setState(key, val, showQuery) {
    state[key] = val;
    window.sessionStorage.setItem(key, val);
    if(showQuery) {
      var query = createQuery(state);
      window.history.replaceState({},'',query ? '?' + query : './');
    }
  }

  function setQueryParams(query) {
    var vars = query.split('&');
    var params = {};
    for(var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if(pair.length === 2) setState(decodeURIComponent(pair[0]), decodeURIComponent(pair[1]),false);
    }
  }

  var search = window.location.search;
  if(search) setQueryParams(search.substring(1));

  $('#help-acc > div').each(function(idx) {
    $(this).accordion({
      heightStyle:'content',
      collapsible: true,
      active: getState('hlp'+idx, 'hide') === 'show' ? 0 : false,
      activate: function(event, ui) {
        var newIndex = $(this).accordion('option','active');
        setState('hlp'+idx, newIndex === 0 ? 'show' : 'hide', true);
      }
    });
  });
        
  $('#tabs').tabs({
    active: getState('tab', 0),
    activate: function(event, ui) {
      var newIndex = ui.newTab.index();
      setState('tab', newIndex, true);
      $.event.trigger({type:'updateChart'});
    },
    create: function(event,ui) {
      $.event.trigger({type:'updateChart'});
    }
  });

  $('#clone_button').button({icons:{primary:'ui-icon-newwin'},text:false}).click(function() {
     window.open(window.location);
  }); 

  var top_keys = getState('keys','');
  var top_value = getState('value','');
  var top_filter = getState('filter','');
	
  $('#keys')
    .val(top_keys)
    .bind( "keydown", function( event ) {
      if ( event.keyCode === $.ui.keyCode.TAB &&
        $( this ).autocomplete( "instance" ).menu.active ) {
	   event.preventDefault();
        }
      })
    .autocomplete({
      minLength: 0,
      source: function( request, response) {
	$.getJSON(keysURL, { search: request.term.split(/,\s*/).pop() }, response)
      },
      focus: function() {
        // prevent value inserted on focus
        return false;
      },
      select: function( event, ui ) {
        var terms = this.value.split(/,\s*/);
        // remove the current input
        terms.pop();
        // add the selected item
        terms.push( ui.item.value );
        // add placeholder to get the comma-and-space at the end
        terms.push( "" );
        this.value = terms.join( "," );
        return false;
      }
    })
    .focus(function() { $(this).autocomplete('search'); });

  $('#value')
    .val(top_value)
    .autocomplete({
       minLength:0,
       source:['bps', 'Bps', 'fps']
    })
    .focus(function() { $(this).autocomplete('search'); });
	
  $('#filter')
    .val(top_filter)
    .bind( "keydown", function( event ) {
      if ( event.keyCode === $.ui.keyCode.TAB &&
        $( this ).autocomplete( "instance" ).menu.active ) {
          event.preventDefault();
        }
    })
    .autocomplete({
      minLength: 0,
      source: function( request, response) {
        $.getJSON(keysURL, { search: request.term.split(/[&|(]\s*/).pop() }, response)
      },
      focus: function() {
        // prevent value inserted on focus
        return false;
      },
      select: function( event, ui ) {
        var val = this.value;
        var re = /[&|(]/g;
        var end = 0;
        while(re.test(val)) { end = re.lastIndex; }
        this.value = val.substring(0,end) + ui.item.value + "=";
        return false;
      }
    })
    .focus(function() { $(this).autocomplete('search'); });

  $('#cleardef').button({icons:{primary:'ui-icon-cancel'},text:false}).click(function() {
    $('#keys').val('');
    $('#value').val('');
    $('#filter').val('');
    top_keys = '';
    top_value = '';
    top_filter = '';
    setState('keys',top_keys);
    setState('value',top_value);
    setState('filter',top_filter,true);
    emptyTopFlows();
  });
  $('#submitdef').button({icons:{primary:'ui-icon-check'},text:false}).click(function() {
    top_keys = $.trim($('#keys').val()).replace(/(,$)/g, "");
    top_value = $.trim($('#value').val());
    top_filter = $.trim($('#filter').val());
    setState('keys',top_keys);
    setState('value',top_value);
    setState('filter',top_filter,true);
    emptyTopFlows();   
  });
  function valueToKey(val) {
    var key;
    switch(val) {
    case 'bps': 
      key = 'bytes'; 
      break;
    case 'Bps': 
      key = 'bytes'; 
      break;
    case 'fps': 
      key = 'frames'; 
      break;
    default: 
      key = val;
    }
    return key;
  }

  function valueToScale(val) {
    return 'bps' === val ? 8 : 1;
  }

  function valueToTitle(val) {
    var title;
    switch(val) {
    case 'bps': 
      title = 'Bits per Second'; 
      break;
    case 'bytes':
      case 'Bps': 
      title = 'Bytes per Second'; 
      break;
    case 'frames':
      case 'fps': 
      title  = 'Frames per Second'; 
      break;
    case 'requests':
      title = 'Requests per Second';
      break;
    default: 
      title = val;
    }
    return title;
  }

  function addFilter(key, value, filter) {
    var newFilter = filter;
    if(!newFilter) newFilter = "";
    if(newFilter.length > 0) newFilter += "&";
    newFilter += key + "='" + value + "'";
    $('#filter').val(newFilter);	 
    top_filter = newFilter;
    setState('filter', top_filter, true);
    emptyTopFlows();
  }

  var $shortcutsTable;
  function initializeShortcutsTable() {
    $shortcutsTable = $('#shortcutstable').DataTable({
      ajax: {
        url: shortcutsURL,
        dataSrc: function(data) { 
          return data; 
        }
      },
      deferRenderer: true,
      columns:[
        {data:'category'},
        {data:'protocol'},
        {data:'description'}
      ],
      columnDefs: [ { targets: 2, orderable: false } ]
    })
    .page.len(getState('topshow'))
    .on('length', function(e,settings,len) {
      setState('topshow', len, true);
    })
    .on('xhr', function(e,settings,json) {
      var len = json.length || 0;
      $('#numshortcuts').val(len).removeClass(len ? 'error' : 'good').addClass(len ? 'good' : 'error');;
    })
    .on('click', 'tr', function(e) {
      var row = $shortcutsTable.row($(this));
      var shortcut = row.data();
      if(!shortcut) return;		
      top_keys = shortcut.keys || '';
      top_value = shortcut.value || '';
      top_filter = shortcut.filter || '';
      $('#keys').val(top_keys);
      $('#value').val(top_value);
      $('#filter').val(top_filter);
      setState('keys', top_keys, false);
      setState('value', top_value, false);
      setState('filter', top_filter, true);
      emptyTopFlows();
    });
  }

  function updateData(data,scale) {
    if(!data 
      || !data.trend 
      || !data.trend.times 
      || data.trend.times.length == 0) return;

    if(scale !== 1) {
      var topn = data.trend.trends.topn;
      for(var i = 0; i < topn.length; i++) {
        var entry = topn[i];
        for(var flow in entry) {
          entry[flow]*=scale;
        }
      }
    }

    if(db.trend) {
      // merge in new data
      var maxPoints = db.trend.maxPoints;
      var remove = db.trend.times.length > maxPoints ? db.trend.times.length - maxPoints : 0;
      db.trend.times = db.trend.times.concat(data.trend.times);
      if(remove) db.trend.times = db.trend.times.slice(remove);
      for(var name in db.trend.trends) {
        db.trend.trends[name] = db.trend.trends[name].concat(data.trend.trends[name]);
        if(remove) db.trend.trends[name] = db.trend.trends[name].slice(remove);
      }
    } else db.trend = data.trend;

    db.trend.start = new Date(db.trend.times[0]);
    db.trend.end = new Date(db.trend.times[db.trend.times.length - 1]);

    $.event.trigger({type:'updateChart'});
  }


  var running_topflows;
  var timeout_topflows;
  function pollTopFlows() {
    running_topflows = true;
    var query = {keys:top_keys,value:valueToKey(top_value),filter:top_filter};
    if(db.trend && db.trend.end) query.after=db.trend.end.getTime();
    var scale = valueToScale(top_value);
    $.ajax({
      url: topURL,
      data: query,
      success: function(data) {
        if(running_topflows) {
          updateData(data,scale);
          timeout_topflows = setTimeout(pollTopFlows, 1000);
        }
      },
      error: function(result,status,errorThrown) {
        if(running_topflows) timeout_topflows = setTimeout(pollTopFlows, 5000);
      }
    });
  }

  function stopPollTopFlows() {
    running_topflows = false;
    if(timeout_topflows) clearTimeout(timeout_topflows);
  }

  function emptyTopFlows() {
    stopPollTopFlows();
    if(db.trend) {
      $(document).off('updateChart');
      $('#topn').stripchart('destroy');
      $('#topn').empty();
      delete db.trend;
    }
    if(!top_keys || !top_value) {
      $('#shortcutstable_wrapper').show();
      $('#topn').hide();
      return;
    }
    $('#shortcutstable_wrapper').hide();
    $('#topn').show();

    if(!db.trend) {
       $('#topn').chart({
          type: 'topn',
          legendHeadings: top_keys.split(','),
          units:valueToTitle(top_value),
          stack: true,
          sep: SEP,
          metric: 'topn'
       },db);
    }

    var query = {keys:top_keys,value:valueToKey(top_value),filter:top_filter};
    pollTopFlows();
  }

  $('#topn').click(function(e) {
    var idx,key,val,tgt = $(e.target);
    if(tgt.is('td')) {
      idx = tgt.index() - 1;
      key = top_keys.split(',')[idx];
      val = tgt.text();
      addFilter(key,val,top_filter);
    }
    else if(tgt.is('div') && tgt.parent().is('td')) {
      var row = tgt.parent().parent();
      row.children().each(function(i,td) {
        if(i>0) {
          idx = i - 1;
          key = top_keys.split(',')[idx];
          val = $(td).text();
          addFilter(key,val,top_filter);
        }
      });
    }
  });

  function refreshShortcuts() {
    $shortcutsTable.ajax.reload();
  } 

  function getShortcuts() {
    location.href = shortcutsURL;
  }
      
  function warningDialog(message) {
    $('<div>' + message + '</div>').dialog({dialogClass:'alert', modal:true, buttons:{'Close': function() { $(this).dialog('close'); }}})
  }

  $('#shortcutsrefresh').button({icons:{primary:'ui-icon-arrowrefresh-1-e'},text:false}).click(refreshShortcuts);
  $('#shortcutsget').button({icons:{primary:'ui-icon-search'},text:false}).click(getShortcuts);
  $('#shortcutsfile').hide().change(function(event) {
    var input = event.target;
    var reader = new FileReader();
    var $this = $(this);
    reader.onload = function(){
      var text = reader.result;
      $this.wrap('<form>').closest('form').get(0).reset();
      $this.unwrap();
      $.ajax({
        url:shortcutsURL,
        type: 'POST',
        contentType:'application/json',
        data:text,
        success:refreshShortcuts,
        error: function() { warningDialog('Badly formatted shortcuts'); }
      });
    };
    reader.readAsText(input.files[0]);
  });
  $('#shortcutsset').button({icons:{primary:'ui-icon-arrowstop-1-n'},text:false}).click(function() {$('#shortcutsfile').click();});

  initializeShortcutsTable();
  emptyTopFlows();
});
