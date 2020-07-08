function play(album, title){
  track = db.tracks.filter(function(data){
    return data.album==album && data.title==title
  })
  u("#status")
    .attr("song", track[0].year +" - "+ track[0].artists + " - " + track[0].title)
    .attr("album", track[0].album)
    .attr("num", track[0].num)
  var audio = u("#audio").first();
  audio.src = "https://subzku.net/uqt" + encodeURI(track[0].file);
  audio.play();
}

u(document).on("DOMContentLoaded", function(){
  u("#audio").on("loadstart", function(){ u("#status").text("Carregando...") })
  u("#audio").on("canplay", function(){
    u("#status").text(u("#status").attr("song"));
  })
  u("#audio").on("ended", function(){
    // play next
    track = db.tracks.filter(function(data){
      return data.album==u("#status").attr("album") && data.num== parseInt(u("#status").attr("num"))+1
    })
    if (track[0]){
      play(track[0].album, track[0].title)
    }
  })

  // random tracks order
  function func(a, b) { return 0.5 - Math.random() }
  db.tracks.sort(func);

  new gridjs.Grid({
    language: {
     'search': {
       'placeholder': 'Busca por Ano, Artista, Album...'
     },
     'pagination': {
       'previous': '<',
       'next': '>',
       'showing': 'Mostrando',
       'results': () => 'canções'
     }
   },
    columns: [{
      id: 'title',
      name: 'Título',
      formatter: (_, row) => gridjs.html(`<a class='play' href='#' onclick='play("${row.cells[2].data}", "${row.cells[0].data}")'>${row.cells[0].data}</a>`)
    },{
       id: 'artists',
       name: 'Artista'
    }, {
      id: 'album',
      name: 'Album'
    }, {
       id: 'year',
       name: 'Ano'
    }],
      pagination: {
      limit: 50
    },
    sort: true,
    data: db.tracks,
    search: {
      enabled: true
    }
  }).render(document.getElementById("player"));
});
