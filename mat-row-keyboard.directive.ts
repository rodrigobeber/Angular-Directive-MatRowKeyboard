import {SelectionModel} from '@angular/cdk/collections';
import {AfterViewInit, Directive, EventEmitter, HostListener, Input, Output} from '@angular/core';
import {MatTable, MatTableDataSource} from '@angular/material/table';

const DEFAULT_OFFSET = 20;

@Directive({
  selector: '[matRowKeyboard]'
})
export class MatRowKeyboardDirective implements AfterViewInit {

  private selection: SelectionModel<any> | undefined;

  // row: REQUIRED
  // pass the object associated with the row defined by the matRowDef attribute
  // for example: *matRowDef="let item ..., so you should pass [row]="item"
  @Input() row: any | undefined;

  // matTable: REQUIRED
  // you need to create a variable associated with the mat-table and pass it here
  // for example: [matTable]="myMatTable"
  @Input() matTable: MatTable<any> | undefined;

  // fixedOffset: OPTIONAL
  // pass this attribute to customize the distance of the PageDown and PageUp (optional)
  @Input() fixedOffset: number | undefined = undefined;

  // containerTag: OPTIONAL
  // if you passed the fixedOffset, this parameter is NOT used, then you don't have to pass it
  // if you did NOT pass the fixedOffset, you need to pass the tag name of the element that contains the CSS "overflow-y=scroll"
  // it's necessary for the directive for calculate the navigation distance for the page/up and page/down keys, base on the view port
  // obs.: cannot have another element with the same tag name between it and the mat-table
  @Input() containerTag = 'MAT-CARD-CONTENT';

  // OPTIONAL
  // pass the selection model variable (optional)
  @Input('selection') set MatRowKeyboardSelection(selection: SelectionModel<any>) {
    this.selection = selection;
  }

  // OPTIONAL
  // you can capture changes in the selection (if you passed the selection model) with this event
  @Output() onKeyboardSelection = new EventEmitter<void>();

  constructor() {
  }

  ngAfterViewInit(): void {
    if (!this.matTable) {
      throw new Error('MatTable is required');
    }
    if (!this.matTable.dataSource) {
      throw new Error('[dataSource] is required');
    }
    if (!this.row) {
      throw new Error('[row] is required');
    }
  }

  private toogleSelection(row: any | undefined): void {
    if (this.selection && row) {
      this.selection.toggle(row);
      this.onKeyboardSelection.emit();
    }
  }

  @HostListener('keydown', ['$event']) onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Enter': case ' ':
        event.preventDefault();
        setTimeout(() => this.toogleSelection(this.row), 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        setTimeout(() => this.navigateToRow(1, event.shiftKey), 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setTimeout(() => this.navigateToRow(-1, event.shiftKey), 0);
        break;
      case 'PageDown':
        event.preventDefault();
        const offsetDown = this.getPageUpDownOffset(this.row);
        setTimeout(() => this.navigateToRow(offsetDown, event.shiftKey), 0);
        break;
      case 'PageUp':
        event.preventDefault();
        const offsetUp = this.getPageUpDownOffset(this.row);
        setTimeout(() => this.navigateToRow(offsetUp ? offsetUp * -1 : 0, event.shiftKey), 0);
        break;
      default:
    }
  }

  private getDataSource(): MatTableDataSource<any> {
    return this.matTable?.dataSource as MatTableDataSource<any>;
  }

  // handle navigation keys
  private navigateToRow(offset: number | undefined, copySelection: boolean): void {

    if (offset === undefined || !this.row) {
        return;
    }

    // get the rows in the same order that is being shown on the screen
    const ds = this.getDataSource();
    const rows = ds.sort ? ds.sortData(ds.data, ds.sort) : ds.data;

    // get the current index, the absolute and the relative within the page
    const startIndexAbs = rows.findIndex(or => or === this.row);
    let startIndexRel = startIndexAbs;
    if (ds.paginator) {
      startIndexRel -= ds.paginator.pageIndex * ds.paginator.pageSize;
    }

    // get the target index, the absolute and the relative within the page
    let targetIndexRel = this.getMatRowIndexInBound(startIndexRel + offset);
    let targetIndexAbs = startIndexAbs  + targetIndexRel - startIndexRel;

    // if using pagination, handle page change
    if (ds.paginator) {
      // if navigating up, and already in the last page row, and has more rows ahead
      if (offset > 0 && (startIndexRel + 1) % ds.paginator.pageSize === 0 && startIndexAbs + 2 <= ds.data.length) {
        ds.paginator.pageIndex = ds.paginator.pageIndex + 1;
        targetIndexRel = 0;
        targetIndexAbs = startIndexAbs + 1;
      } else
      // if navigating down, and already in the first page row, and has more rows behind
      if (offset < 0 && startIndexRel === 0 && startIndexAbs - 1 >= 0) {
        ds.paginator.pageIndex = ds.paginator.pageIndex - 1;
        targetIndexRel = ds.paginator.pageSize - 1;
        targetIndexAbs = startIndexAbs - 1;
      }
    }

    // handle selection copy
    if (this.selection && copySelection) {
      // get the current selection: selected or unselected
      const select = this.selection.isSelected(this.row);
      // copy the selection to the end of the navigation
      this.setSelectionInRange(select, startIndexAbs, targetIndexAbs, rows);
      // emit the event
      this.onKeyboardSelection.emit();
    }

    // set the focus to the end of the navigation
    const targetMatRowElement = this.getMatRowElementByIndex(targetIndexRel);
    if (targetMatRowElement) {
        targetMatRowElement.focus();
    }
  }

  private setSelectionInRange(select: boolean, indexA: number, indexB: number, rows: any[]): void {
      // if navigating down
      if (indexA < indexB) {
        // loop forward copying the selection
        for (let i = indexA + 1; i <= indexB; i++) {
          select ? this.selection?.select(rows[i]) : this.selection?.deselect(rows[i]);
        }
      } else {
        // loop backward copying the selection
        for (let i = indexA - 1; i >= indexB; i--) {
          select ? this.selection?.select(rows[i]) : this.selection?.deselect(rows[i]);
        }
      }
  }

  // apply bound constraints to the index, returning an index inside the bounds
  private getMatRowIndexInBound(index: number): number {
    const ds = this.getDataSource();
    let maxIndex = ds.data.length - 1;
    if (ds.paginator) {
      maxIndex = Math.min(ds.data.length - (ds.paginator.pageIndex * ds.paginator.pageSize), ds.paginator.pageSize) - 1;
    }
    return index < 0 ? 0 : index > maxIndex ? maxIndex : index;
  }

  // get the HTML element for a given index
  private getMatRowElementByIndex(index: number): HTMLElement | undefined {
    if (this.matTable) {
        const matRowsElements = this.matTable._getRenderedRows(this.matTable._rowOutlet);
        return matRowsElements[index];
    }
    return undefined;
  }

  // ------ ALL CODE BELOW IS FOR CALCULATION OF THE DISTANCE OF THE PGUP/PGDOWN

  private getPageUpDownOffset(row: any | undefined): number | undefined {

    if (this.fixedOffset || !row) {
      return this.fixedOffset;
    }

    let offset = DEFAULT_OFFSET;

    // calculate the row height, in pixels
    const matRowElement = this.getMatRowElement(row);
    if (!matRowElement) {
        return undefined;
    }
    const rowHeight = matRowElement.getBoundingClientRect().height;

    // get the HTML element that contains the CSS "overflow-y=scroll"
    const containerElement = this.getParentElementByTag(matRowElement, this.containerTag);

    // get the mat table HTML element
    const tableElement = this.getParentElementByTag(matRowElement, 'TABLE');

    // get the mat-header HTML element
    if (!tableElement) {
        return undefined;
    }
    const trElement = tableElement.querySelector('TR');

    // if all found
    if (containerElement && tableElement && trElement) {
      // get the rectangles
      const containerRect = containerElement.getBoundingClientRect();
      const tableRect = tableElement.getBoundingClientRect();
      const trRect = trElement.getBoundingClientRect();
      // get the top of the first line in the view port
      const top = containerRect.top + trRect.height;
      // get the bottom of the last line in the view port
      const bottom = Math.min(containerRect.bottom, tableRect.bottom);
      // calculate the number of rows in the view port, then it less 1 is the offset
      offset = Math.round((bottom - top) / rowHeight) - 1;
    }

    // return the distance for the PGUP/PGDOWN navigation
    return offset;
  }

  // helpers for "getPageUpDownOffset"

  private getMatRowElement(row: any, offset: number = 0): HTMLElement | undefined {
    const index = this.getMatRowElementIndex(row);
    const newIndex = offset !== 0 ? this.getMatRowIndexInBound(index + offset) : index;
    return this.getMatRowElementByIndex(newIndex);
  }

  private getMatRowElementIndex(row: any): number {
    const ds = this.getDataSource();
    const rows = ds.sort ? ds.sortData(ds.data, ds.sort) : ds.data;
    let index = rows.findIndex(or => or === row);
    if (ds.paginator) {
      index -= ds.paginator.pageIndex * ds.paginator.pageSize;
    }
    return index;
  }

  private getParentElementByTag(el: HTMLElement, parentTag: string): HTMLElement | undefined {
    while (el && el.parentNode) {
      el = el.parentNode as HTMLElement;
      if (el.tagName.toUpperCase() === parentTag.toUpperCase()) {
        return el;
      }
    }
    return undefined;
  }

}
