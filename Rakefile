require 'erb'
require 'json'

def _site
  File.join(Dir::pwd, "_site")
end

def _site_index_html
  File.join(_site, "index.html")
end

task :build do
  File.open("data.json", "r") do |f|
    @categories = JSON.parse(f.read)["categories"]
  end

  File.open("index.html.erb", "r") do |f|
    @template = f.read
  end

  p "Building template..."

  index_html = ERB.new(@template).result(binding)

  p "Making _site..."

  if FileTest::directory?(_site)
    FileUtils.rm_rf(_site, secure: true)
  end
  Dir::mkdir(_site)

  p "Writing index.html..."

  File.open(_site_index_html, "w") do |f|
    f.write(index_html)
  end

  p "Copying assets..."

  assets = File.join(Dir::pwd, "sample", "assets")
  FileUtils.cp_r(assets, File.join(_site, "assets"))

  p "Done!"
end

task :open do
  `open #{_site_index_html}`
end

task :deploy do
end