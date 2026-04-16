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
    unless metas[:artists].select{|a| a[:name] == primary_artist(meta.artist)}.first
      metas[:artists] << {name: primary_artist(meta.artist), albums: []}
    end
    artist = metas[:artists].select{|a| a[:name] == primary_artist(meta.artist)}.first
    unless artist[:albums].select{|a| a[:title] == strip(meta.album)}.first
      artist[:albums] << { title: strip(meta.album), year: meta.year, path: File.dirname(mp3).split('/').last, tracks: [] }
    end
    album = artist[:albums].select{|a| a[:title] == strip(meta.album)}.first
    album[:tracks] << { title: strip(meta.title), num: meta.tracknum || 0, file: File.basename(mp3), artists: strip(meta.artist) }
    album[:tracks].sort_by!{ |k,v| k[:num] }
  end

  File.open("uqt_artists.json", 'w') { |file| file.write(metas.to_json) }
end

def by_albums!
  albums_by_path = {}
  all = Dir['unzips/*/*.mp3']
  count = all.count
  all.each do |mp3|
    puts count -= 1
    meta = Mp3Info.open(mp3).tag
    path = File.dirname(mp3).split('/').last

    # Initialize album entry if not seen
    unless albums_by_path[path]
      albums_by_path[path] = {
        title: strip(meta.album),
        year: meta.year,
        path: path,
        tracks: []
      }
    end

    # Add track, deduplicate by filename
    file = File.basename(mp3)
    unless albums_by_path[path][:tracks].any? { |t| t[:file] == file }
      albums_by_path[path][:tracks] << {
        title: strip(meta.title),
        num: meta.tracknum || 0,
        file: file,
        artists: strip(meta.artist)
      }
    end
  end

  # Sort tracks by num, determine artist (various if multiple)
  albums = albums_by_path.map do |path, album|
    album[:tracks].sort_by! { |t| t[:num] }
    artists = album[:tracks].map { |t| t[:artists] }.uniq
    album[:artist] = artists.length == 1 ? artists.first : 'Various Artists'
    album.delete_if { |k, v| k == :album }
    album
  end

  # Sort albums by year descending
  albums.sort_by! { |a| -a[:year] }

  output = { albums: albums }
  File.open("js/uqt-albums.js", 'w') { |file| file.write("db = #{output.to_json}") }
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

def primary_artist(str)
  return nil unless str
  str.strip.split(/,| e | &| feat\.| with /i).first&.strip
end

by_albums!
