#!/bin/ruby
# author: extrapolo.com
# generate JSON DB from unzipped UQT folders

require 'mp3info'
require 'json'

def by_artists!
  metas = { artists: [] }
  all = Dir['unzips/*/*.mp3']
  count = all.count
  all.each do |mp3|
    puts count -= 1
    meta = Mp3Info.open(mp3).tag
    unless metas[:artists].select{|a| a[:name] == strip(meta.artist)}.first
      metas[:artists] << {name: strip(meta.artist), albums: []}
    end
    artist = metas[:artists].select{|a| a[:name] == strip(meta.artist)}.first
    unless artist[:albums].select{|a| a[:title] == strip(meta.album)}.first
      artist[:albums] << { title: strip(meta.album), year: meta.year, path: File.dirname(mp3).split('/').last, tracks: [] }
    end
    album = artist[:albums].select{|a| a[:title] == strip(meta.album)}.first
    album[:tracks] << { title: strip(meta.title), num: meta.tracknum || 0, file: File.basename(mp3) }
    album[:tracks].sort_by!{ |k,v| k[:num] }
  end

  File.open("uqt_artists.json", 'w') { |file| file.write(metas.to_json) }
end

def by_tracks!
  metas = { tracks: [] }
  all = Dir['unzips/*/*.mp3']
  count = all.count
  all.each do |mp3|
    puts count -= 1
    meta = Mp3Info.open(mp3).tag
    metas[:tracks] << { title: strip(meta.title), num: meta.tracknum || 0, file: mp3, album: strip(meta.album), artists: strip(meta.artist), year: meta.year  }
    puts meta.title
    File.open("uqt.json", 'w') { |file| file.write(metas.to_json) }
  end
end

def strip(str)
  str.strip if str
end

by_tracks!
