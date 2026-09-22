/* Runs before first paint. Marks that JavaScript is available so CSS may hide elements for scroll reveals;
   without this class every element stays visible. */
document.documentElement.classList.add("js");
