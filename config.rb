module ToolboxHelpers
  def categories
    @categories ||= begin
      File.open("data.json", "r") do |f|
        JSON.parse(f.read)["categories"]
      end
    end
  end
end

helpers ToolboxHelpers

# Build-specific configuration
configure :build do
end
