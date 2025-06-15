
namespace ingest;

class DirWatcher
{
    public void Watch(string directoryName)
    {
        if (!Directory.Exists(directoryName))
        {
            throw new DirectoryNotFoundException(directoryName);
        }

        Console.WriteLine($"Directory: {directoryName}");

        using var watcher = new FileSystemWatcher(directoryName);
            
        watcher.NotifyFilter = NotifyFilters.Attributes
                               | NotifyFilters.CreationTime
                               | NotifyFilters.DirectoryName
                               | NotifyFilters.FileName
                               | NotifyFilters.LastAccess
                               | NotifyFilters.LastWrite
                               | NotifyFilters.Security
                               | NotifyFilters.Size;
            
        watcher.Changed += OnChanged;
        watcher.Created += OnCreated;
        watcher.Error += OnError;
            
        watcher.Filter = "*.ibt";
        watcher.IncludeSubdirectories = true;
        watcher.EnableRaisingEvents = true;
    }
    
    private static void OnCreated(object sender, FileSystemEventArgs e)
    {
        if (e.ChangeType == WatcherChangeTypes.Created)
        {
            Console.WriteLine($"Created: {e.FullPath}");
            Console.WriteLine($"sender: {sender}");
        }
    }

    private static void OnChanged(object sender, FileSystemEventArgs e)
    {
        Console.WriteLine($"Changed: {e.FullPath}");
        Console.WriteLine($"sender: {sender}");
    }

    private static void OnError(object sender, ErrorEventArgs e)
    {
        var ex = e.GetException();
        if (ex != null)
        {
            Console.WriteLine($"Message: {ex.Message}");
            Console.WriteLine("Stacktrace:");
            Console.WriteLine(ex.StackTrace);
            Console.WriteLine();
        }
    }
}