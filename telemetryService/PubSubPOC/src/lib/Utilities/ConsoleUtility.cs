using System;

namespace PubSubPOC.Core.Utilities
{
    public static class ConsoleUtility
    {
        private const char _block = '■';
        private const string _back = "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b";
        private const string _twirl = "-\\|/";

        public static void WriteProgressBar(int percent, bool update = false)
        {
            if (update)
                Console.Write(_back);
            Console.Write("[");
            var p = (int)((percent / 10f) + .5f);
            for (var i = 0; i < 10; ++i)
            {
                if (i >= p)
                    Console.Write(' ');
                else
                    Console.Write(_block);
            }
            Console.Write("] {0,3:##0}%", percent);
        }

        public static void WriteProgress(int progress, bool update = false)
        {
            if (update)
                Console.Write("\b");
            Console.Write(_twirl[progress % _twirl.Length]);
        }
    }
}