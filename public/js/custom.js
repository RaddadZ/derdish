$(function(){
	$('#amac').on('click',function(event){
		var title = $(this).text();
		$('#panel-title h3').html(title);
		$.get('AmacVeHedefler.txt', function(data) {
			$('#rightMenu').html('<div id="rightPanel" class="panel panel-default"><div id="amacBody" style="padding:40px;">'+data+'</div></div>');
		},'text');
	})
	$('#plan').on('click',function(event){
		var title = $(this).text();
		$('#panel-title h3').html(title);
		$("#rightMenu").load("DersPlani.html");
	})
	$('#cikti').on('click',function(event){
		var title = $(this).text();
		$('#panel-title h3').html(title);
		$.ajax({
		    url: 'ProgramOgrenmeCiktilari.xml',
		    dataType: "xml",
		    success: parse,
			error: function(){alert("Error: Something went wrong");}
		});

		function parse(document){
			var text = "<h3>Siniflandirilmis</h3>";
			$(document).find("item").each(function(){
				text = text + '<br><b>' + $(this).find('name').text() + '</b><br><br><div style="text-align: justify;"><ul>';
				$(this).find('point').each(function(){
					text = text + '<li>' + $(this).text() + '</li>'
				});
				text = text + '</ul></div>'
			});
			$('#rightMenu').html('<div id="rightPanel" class="panel panel-default"><div id="amacBody" style="padding:40px;">'+text+'</div></div>');
		}
	})
});	