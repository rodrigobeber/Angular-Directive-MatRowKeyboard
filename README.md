This is an angular directive that adds keyboard navigation functionality to a MatTable

It supports (all optional):
- Toggling a SelectionModel
- MatPaginator associated with the MatTable
- MatSort associated with the MatTable

Keys:
- Space bar or ENTER toggle selection
- ArrowUp, ArrowDown, PgUp, and PgDown navigates
- Shift + navigation key (ArrowUp, ArrowDown, PgUp, and PgDown) copies the current row selection to the end of the navigation

How to use in your project:

1) Import & declare matRowKeyboardDirective in the desired module

2) In the element mat-row, add the following attributes, for example:
   matRowKeyboard [selection]="this.selection" [row]="row" [matTable]="matTable" tabindex=0 (onKeyboardSelection)="onSelect()"

obs.: the attribute tabindex=0 is required

Example:
    <table mat-table #matTable [dataSource]="dataSource" class="mat-elevation-z8">
    ...
      <tr mat-rowmatRowDef="let item; let i = index; columns: visibleColumns" matRowKeyboard
          (keydown)="onKeyDown($event, item)" [selection]="this.selection" [row]="item" [matTable]="matTable"
          tabindex=0 (onKeyboardSelection)="onSelection()">
      </tr>

For further details about the parameters, see the comments in the source code.

That still some work to do as:
- Not hiding the first line under the table header
- Accepting focus automatically when the web page is loaded

Use it as you want, change it as you want.